import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const actionYml = readFileSync(new URL("../action.yml", import.meta.url), "utf8");

describe("action.yml runtime", () => {
  it("runs on node24, the runtime GitHub is moving JavaScript actions to", () => {
    const match = actionYml.match(/^\s*using:\s*"?([\w.-]+)"?\s*$/m);
    assert.ok(match, "action.yml must declare runs.using");
    assert.equal(match[1], "node24");
  });
});
