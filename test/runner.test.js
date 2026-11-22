import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ActionError, collectCoverage, matchRepository, renderSummary } from "../src/runner.js";

const repositories = [
  { id: 11, name: "forbiddenlink/automadocs" },
  { id: 12, name: "acme/api" },
  { id: 13, name: "other/api" },
];

function stubFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      json: async () => next.body,
    };
  };
  return { fetchImpl, calls };
}

describe("matchRepository", () => {
  it("matches owner/name", () => {
    assert.equal(matchRepository(repositories, "forbiddenlink/automadocs").id, 11);
  });

  it("matches case-insensitively", () => {
    assert.equal(matchRepository(repositories, "ForbiddenLink/AutomaDocs").id, 11);
  });

  it("matches a repository registered under its bare name", () => {
    assert.equal(matchRepository([{ id: 20, name: "automadocs" }], "forbiddenlink/automadocs").id, 20);
  });

  it("points at onboarding when the repository is not documented", () => {
    assert.throws(() => matchRepository(repositories, "acme/unknown"), /not documented/);
  });

  it("refuses an ambiguous bare name rather than picking one", () => {
    assert.throws(() => matchRepository(repositories, "someone/api"), /matches 2/);
  });

  it("matches by numeric id", () => {
    assert.equal(matchRepository(repositories, "12").id, 12);
  });
});

describe("renderSummary", () => {
  it("renders the score, breakdown and undocumented items", () => {
    const summary = renderSummary({
      repoName: "acme/api",
      overallScore: 72.4,
      breakdown: { readme: 100, functions: { score: 55 } },
      undocumentedItems: [{ name: "handleWebhook" }],
    });

    assert.match(summary, /\*\*acme\/api\*\*: 72%/);
    assert.match(summary, /\| readme \| 100% \|/);
    assert.match(summary, /\| functions \| 55% \|/);
    assert.match(summary, /- handleWebhook/);
  });

  it("calls out a score below the threshold", () => {
    const summary = renderSummary({ repoName: "acme/api", overallScore: 40 }, { minCoverage: 70 });
    assert.match(summary, /Below the required 70%/);
  });

  it("truncates a long undocumented list", () => {
    const undocumentedItems = Array.from({ length: 14 }, (_, i) => ({ name: `fn${i}` }));
    const summary = renderSummary({ repoName: "acme/api", overallScore: 10, undocumentedItems });
    assert.match(summary, /and 4 more/);
  });
});

describe("upgrade link", () => {
  const cov = { repoName: "acme/api", overallScore: 72 };

  it("ends the summary with one tagged link by default", () => {
    const lines = renderSummary(cov).split("\n");
    const last = lines.at(-1);
    assert.match(last, /\(https:\/\/automadocs\.com\/\?utm_source=github-action&utm_medium=marketplace\)/);
    assert.equal(lines.filter((l) => l.includes("automadocs.com")).length, 1);
  });

  it("omits the link when showUpgradeLink is false", () => {
    assert.doesNotMatch(renderSummary(cov, { showUpgradeLink: false }), /automadocs\.com/);
  });

  it("has no em dashes in the summary", () => {
    assert.doesNotMatch(renderSummary(cov, { minCoverage: 90 }), /\u2014/);
  });
});

describe("collectCoverage", () => {
  it("sends both auth headers and reports the score", async () => {
    const { fetchImpl, calls } = stubFetch([
      { body: { repositories } },
      { body: { repoName: "acme/api", overallScore: 81, undocumentedItems: [] } },
    ]);

    const result = await collectCoverage({
      apiKey: "ak_test",
      apiUrl: "https://api.automadocs.com",
      repository: "acme/api",
      fetchImpl,
    });

    assert.equal(result.repository.id, 12);
    assert.equal(result.failed, false);
    assert.equal(calls[0].init.headers["X-API-Key"], "ak_test");
    assert.equal(calls[0].init.headers.Authorization, "Bearer ak_test");
    assert.deepEqual(JSON.parse(calls[1].init.body), { repo_id: 12 });
  });

  it("fails the step below the threshold", async () => {
    const { fetchImpl } = stubFetch([
      { body: { repositories } },
      { body: { repoName: "acme/api", overallScore: 51 } },
    ]);

    const result = await collectCoverage({
      apiKey: "ak_test",
      apiUrl: "https://api.automadocs.com",
      repository: "acme/api",
      minCoverage: 70,
      fetchImpl,
    });

    assert.equal(result.failed, true);
    assert.match(result.reason, /51%, below the required 70%/);
  });

  it("passes when the score meets the threshold exactly", async () => {
    const { fetchImpl } = stubFetch([
      { body: { repositories } },
      { body: { repoName: "acme/api", overallScore: 70 } },
    ]);

    const result = await collectCoverage({
      apiKey: "ak_test",
      apiUrl: "https://api.automadocs.com",
      repository: "acme/api",
      minCoverage: 70,
      fetchImpl,
    });

    assert.equal(result.failed, false);
  });

  it("surfaces an API error message", async () => {
    const { fetchImpl } = stubFetch([
      { ok: false, status: 401, body: { message: "API key not found or invalid" } },
    ]);

    await assert.rejects(
      collectCoverage({
        apiKey: "ak_bad",
        apiUrl: "https://api.automadocs.com",
        repository: "acme/api",
        fetchImpl,
      }),
      (error) => error instanceof ActionError && /not found or invalid/.test(error.message)
    );
  });

  it("refuses to run without an api key", async () => {
    await assert.rejects(
      collectCoverage({ apiUrl: "https://api.automadocs.com", repository: "acme/api" }),
      /No api-key input/
    );
  });
});

describe("missing score", () => {
  const repos = { body: { repositories: [{ id: 1, name: "a/b" }] } };

  for (const [label, payload] of [
    ["empty payload", {}],
    ["null score", { overallScore: null }],
    ["blank string", { overallScore: " " }],
    ["non-numeric", { overallScore: "n/a" }],
  ]) {
    it(`rejects ${label} instead of reporting 0%`, async () => {
      const { fetchImpl } = stubFetch([repos, { body: payload }]);
      await assert.rejects(
        collectCoverage({ apiKey: "k", apiUrl: "http://x", repository: "a/b", minCoverage: 0, fetchImpl }),
        ActionError,
      );
    });
  }

  it("still accepts a real zero score", async () => {
    const { fetchImpl } = stubFetch([repos, { body: { overallScore: 0, repoName: "a/b" } }]);
    const r = await collectCoverage({ apiKey: "k", apiUrl: "http://x", repository: "a/b", fetchImpl });
    assert.equal(r.score, 0);
  });
});
