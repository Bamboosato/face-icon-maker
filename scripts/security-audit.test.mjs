import test from "node:test";
import assert from "node:assert/strict";
import { parseAuditResult } from "./security-audit.mjs";

function report(total = 0) {
  const vulnerabilities = total ? { sample: { severity: "low", nodes: ["node_modules/sample"],
    via: [{ url: "https://example.com/advisory", severity: "low" }] } } : {};
  return JSON.stringify({ auditReportVersion: 2, vulnerabilities,
    metadata: { vulnerabilities: { info: 0, low: total, moderate: 0, high: 0, critical: 0, total } } });
}
test("reads both clean and vulnerable successful audit responses for policy evaluation", () => {
  for (const total of [0, 1]) assert.equal(parseAuditResult({ status: total, stdout: report(total) }, "test").metadata.vulnerabilities.total, total);
});
test("fails closed on timeout, signal, non-audit exit, malformed JSON, and contradictory exit status", () => {
  for (const result of [
    { error: new Error("ETIMEDOUT"), status: null }, { status: null, signal: "SIGTERM" },
    { status: 2, stdout: report() }, { status: 0, stdout: "invalid" },
    { status: 1, stdout: report() }, { status: 0, stdout: report(1) },
    { status: 1, stdout: JSON.stringify({ error: { code: "ENETUNREACH" } }) },
  ]) assert.throws(() => parseAuditResult(result, "test"));
});
