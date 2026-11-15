import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const actionYml = readFileSync(new URL("../action.yml", import.meta.url), "utf8");

describe("action.yml runtime", () => {
  it("runs on node24, the runtime GitHub is moving JavaScript actions to", () => {
    const match = actionYml.match(/^\s*using:\s*"?([\w.-]+)"?\s*$/m);
    assert.ok(match, "action.yml must declare runs.using");
    assert.equal(match[1], "node24");
  });
});

describe("fail-on-error", () => {
  async function run(failOnError) {
    const server = createServer((req, res) => {
      res.statusCode = 503;
      res.end("{}");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const result = await new Promise((resolve) => {
      const child = spawn(process.execPath, [new URL("../src/index.js", import.meta.url).pathname], {
        env: {
          PATH: process.env.PATH,
          "INPUT_API-KEY": "test-key",
          "INPUT_API-URL": url,
          INPUT_REPOSITORY: "a/b",
          ...(failOnError === undefined ? {} : { "INPUT_FAIL-ON-ERROR": failOnError }),
        },
      });
      let out = "";
      child.stdout.on("data", (d) => (out += d));
      child.on("close", (code) => resolve({ code, out }));
    });
    server.close();
    return result;
  }

  it("fails by default on an API outage", async () => {
    const { code, out } = await run(undefined);
    assert.equal(code, 1);
    assert.match(out, /::error::/);
  });

  it("warns and passes when fail-on-error is false", async () => {
    const { code, out } = await run("false");
    assert.equal(code, 0);
    assert.match(out, /::warning::/);
  });
});
