/**
 * Pure logic for the AutomaDocs coverage action, kept separate from the
 * GitHub-runner plumbing so it can be tested without a runner.
 */

export class ActionError extends Error {}

const API_PATHS = {
  listRepos: "/api/mcp/tools/list_repos",
  coverage: "/api/mcp/tools/get_coverage",
};

/**
 * Both headers are sent on purpose: X-API-Key is what lets a non-browser client
 * through the origin check, Authorization is the documented form.
 */
async function post(apiUrl, path, body, apiKey, fetchImpl) {
  const response = await fetchImpl(`${apiUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ActionError(
      payload?.message || payload?.error || `AutomaDocs API request failed (${response.status})`
    );
  }

  return payload;
}

/**
 * Find the AutomaDocs repository for a workflow's `owner/name`. Matching on the
 * bare name too, because a repository can be registered under either form.
 */
export function matchRepository(repositories, target) {
  const wanted = String(target ?? "").toLowerCase();
  if (!wanted) {
    throw new ActionError("No repository given.");
  }

  if (/^\d+$/.test(wanted)) {
    const byId = repositories.find((repo) => String(repo.id) === wanted);
    if (byId) return byId;
    throw new ActionError(`AutomaDocs has no repository with id ${wanted}.`);
  }

  // An exact owner/name match wins outright. Only when nothing matches exactly
  // do we widen to the bare name, so "acme/api" is never called ambiguous just
  // because "other/api" also exists.
  const named = (repo) => String(repo.name ?? "").toLowerCase();
  const exact = repositories.find((repo) => named(repo) === wanted);
  if (exact) return exact;

  const bare = wanted.split("/").pop();
  const matches = repositories.filter(
    (repo) => named(repo) === bare || named(repo).split("/").pop() === bare
  );

  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    throw new ActionError(
      `"${target}" is not documented on AutomaDocs yet. Add it at https://automadocs.com, ` +
        "or set the repository input to an id."
    );
  }

  throw new ActionError(
    `"${target}" matches ${matches.length} AutomaDocs repositories. Set the repository input to an id.`
  );
}

/** Markdown table for the job summary. */
export function renderSummary(coverage, { minCoverage } = {}) {
  const score = Number(coverage.overallScore ?? 0);
  const lines = [
    "## AutomaDocs coverage",
    "",
    `**${coverage.repoName}** — ${score.toFixed(0)}%`,
    "",
  ];

  const breakdown = Object.entries(coverage.breakdown ?? {});
  if (breakdown.length > 0) {
    lines.push("| Area | Score |", "| --- | ---: |");
    for (const [area, value] of breakdown) {
      const areaScore = typeof value === "object" && value !== null ? value.score : value;
      lines.push(`| ${area} | ${Number(areaScore ?? 0).toFixed(0)}% |`);
    }
    lines.push("");
  }

  const undocumented = coverage.undocumentedItems ?? [];
  if (undocumented.length > 0) {
    lines.push(`${undocumented.length} undocumented item(s):`, "");
    for (const item of undocumented.slice(0, 10)) {
      lines.push(`- ${item.name ?? item.path ?? JSON.stringify(item)}`);
    }
    if (undocumented.length > 10) {
      lines.push(`- …and ${undocumented.length - 10} more`);
    }
    lines.push("");
  }

  if (minCoverage !== undefined && score < minCoverage) {
    lines.push(`> Below the required ${minCoverage}%.`);
  }

  return lines.join("\n");
}

/**
 * Fetch coverage and decide whether the step passes.
 *
 * @returns {{coverage: object, repository: object, summary: string, failed: boolean, reason?: string}}
 */
export async function collectCoverage({ apiKey, apiUrl, repository, minCoverage, fetchImpl }) {
  if (!apiKey) {
    throw new ActionError("No api-key input. Store an AutomaDocs API key as a repository secret.");
  }

  const doFetch = fetchImpl ?? globalThis.fetch;
  const listed = await post(apiUrl, API_PATHS.listRepos, {}, apiKey, doFetch);
  const match = matchRepository(listed?.repositories ?? [], repository);
  const coverage = await post(apiUrl, API_PATHS.coverage, { repo_id: match.id }, apiKey, doFetch);

  const score = Number(coverage.overallScore ?? 0);
  const failed = minCoverage !== undefined && score < minCoverage;

  return {
    coverage,
    repository: match,
    summary: renderSummary(coverage, { minCoverage }),
    failed,
    reason: failed
      ? `Documentation coverage is ${score.toFixed(0)}%, below the required ${minCoverage}%.`
      : undefined,
  };
}
