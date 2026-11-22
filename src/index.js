#!/usr/bin/env node
/**
 * GitHub runner entry point. Reads the action inputs GitHub puts in the
 * environment, runs the coverage check, and writes outputs/summary back
 * through the runner's file protocol.
 *
 * Deliberately dependency-free (no @actions/core) so the action ships as
 * plain source with no vendored node_modules to keep in sync.
 */

import { appendFileSync } from "node:fs";
import { EOL } from "node:os";
import { ActionError, collectCoverage } from "./runner.js";

function getInput(name) {
  const value = process.env[`INPUT_${name.toUpperCase().replace(/ /g, "_")}`];
  return value === undefined ? "" : value.trim();
}

function appendToFile(envVar, content) {
  const target = process.env[envVar];
  if (!target) return;
  appendFileSync(target, `${content}${EOL}`, "utf8");
}

function setOutput(name, value) {
  // Heredoc form so a multi-line value cannot break the output file.
  const delimiter = `ghadelimiter_${Math.random().toString(36).slice(2)}`;
  appendToFile("GITHUB_OUTPUT", `${name}<<${delimiter}${EOL}${value}${EOL}${delimiter}`);
}

async function main() {
  const minCoverageInput = getInput("min-coverage");
  const minCoverage = minCoverageInput === "" ? undefined : Number(minCoverageInput);

  if (minCoverage !== undefined && Number.isNaN(minCoverage)) {
    throw new ActionError(`min-coverage must be a number, got "${minCoverageInput}".`);
  }

  const result = await collectCoverage({
    apiKey: getInput("api-key"),
    apiUrl: getInput("api-url") || "https://api.automadocs.com",
    repository: getInput("repository") || process.env.GITHUB_REPOSITORY,
    minCoverage,
    showUpgradeLink: getInput("show-upgrade-link").toLowerCase() !== "false",
  });

  const score = result.score;
  setOutput("score", String(score));
  setOutput("repository-id", String(result.repository.id));
  setOutput("undocumented-count", String((result.coverage.undocumentedItems ?? []).length));

  if (getInput("summary") !== "false") {
    appendToFile("GITHUB_STEP_SUMMARY", result.summary);
  }

  console.log(`${result.coverage.repoName}: documentation coverage ${score.toFixed(0)}%`);

  if (result.failed) {
    console.log(`::error::${result.reason}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof ActionError ? error.message : String(error?.message ?? error);
  // fail-on-error defaults to true. Set it to "false" to only warn when the
  // report itself could not be produced (API outage, missing score). A score
  // below min-coverage still fails: that is a result, not an error.
  if (getInput("fail-on-error").toLowerCase() === "false") {
    console.log(`::warning::${message} (fail-on-error is false, so the step passes.)`);
    return;
  }
  console.log(`::error::${message}`);
  process.exitCode = 1;
});
