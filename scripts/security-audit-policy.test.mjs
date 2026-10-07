import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAudits } from "./security-audit-policy.mjs";

const advisory = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
export function audit(vulnerabilities = {}) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  for (const item of Object.values(vulnerabilities)) { counts[item.severity]++; counts.total++; }
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: counts } };
}
function fixture() {
  return {
    full: audit({
      braces: { severity: "high", nodes: ["node_modules/braces"], via: [{ url: advisory, severity: "high" }] },
      parent: { severity: "high", nodes: ["node_modules/parent"], via: ["braces"] },
    }),
    production: audit(),
    lock: { packages: {
      "node_modules/braces": { dev: true, version: "3.0.3" },
      "node_modules/parent": { dev: true, version: "1.0.0" },
    } },
    exception: { advisory, owner: "maintainer", reason: "Test fixture only; not an active exception",
      expires: "2026-11-05T00:00:00Z", packages: { braces: "3.0.3", parent: "1.0.0" } },
    now: new Date("2026-10-07T00:00:00Z"),
  };
}
test("strict default accepts zero findings without any exception", () => {
  assert.deepEqual(evaluateAudits({ full: audit(), production: audit() }), { ok: true, blocked: [], excepted: [] });
});
test("strict default rejects findings when no exception file is present", () => {
  const input = fixture(); delete input.exception;
  assert.equal(evaluateAudits(input).ok, false);
});
test("permits only the exact recorded dev advisory and derived parent", () => {
  assert.deepEqual(evaluateAudits(fixture()).excepted, ["braces", "parent"]);
  assert.equal(evaluateAudits(fixture()).ok, true);
});
for (const [label, offset, ok] of [["immediately before", -1, true], ["exactly at", 0, false], ["after", 1, false]]) {
  test(`expiry boundary: ${label} the deadline`, () => {
    const input = fixture(); input.now = new Date(Date.parse(input.exception.expires) + offset);
    assert.equal(evaluateAudits(input).ok, ok);
  });
}
test("accepts the fixed tree after the obsolete exception is removed", () => {
  const input = fixture(); input.full = audit(); delete input.exception;
  assert.equal(evaluateAudits(input).ok, true);
});
for (const severity of ["info", "low", "moderate", "high", "critical"]) {
  test(`rejects ${severity} production findings even when development is excepted`, () => {
    const input = fixture(); input.production = audit({ braces: { ...input.full.vulnerabilities.braces, severity } });
    const result = evaluateAudits(input);
    assert.equal(result.ok, false); assert.ok(result.blocked.includes("production: braces"));
  });
}
test("rejects an additional advisory in an excepted package", () => {
  const input = fixture(); input.full.vulnerabilities.braces.via.push({ url: "https://example.com/new", severity: "low" });
  assert.equal(evaluateAudits(input).ok, false);
});
test("rejects critical causes or package severities despite a matching URL", () => {
  for (const location of ["cause", "package"]) {
    const input = fixture();
    if (location === "cause") input.full.vulnerabilities.braces.via[0].severity = "critical";
    else { input.full.vulnerabilities.braces.severity = "critical"; input.full = audit(input.full.vulnerabilities); }
    assert.equal(evaluateAudits(input).ok, false);
  }
});
test("rejects an unreviewed new dependency", () => {
  const input = fixture(); input.full = audit({ ...input.full.vulnerabilities,
    unexpected: { ...input.full.vulnerabilities.braces, nodes: ["node_modules/unexpected"] } });
  assert.ok(evaluateAudits(input).blocked.includes("full: unexpected"));
});
test("rejects dev-to-runtime classification and version changes", () => {
  for (const change of [{ dev: false }, { dev: undefined }, { version: "3.0.4" }]) {
    const input = fixture(); Object.assign(input.lock.packages["node_modules/braces"], change);
    assert.equal(evaluateAudits(input).ok, false);
  }
});
test("rejects added or replaced nested paths even at the recorded version", () => {
  for (const additional of [true, false]) {
    const input = fixture(); const path = "node_modules/other/node_modules/braces";
    input.lock.packages[path] = { dev: true, version: "3.0.3" };
    input.full.vulnerabilities.braces.nodes = additional ? ["node_modules/braces", path] : [path];
    assert.equal(evaluateAudits(input).ok, false);
  }
});
test("rejects missing exception rationale, owner, lock, invalid dates, and invalid advisory URLs", () => {
  for (const field of ["owner", "reason", "packages", "advisory", "expires"]) {
    const input = fixture(); delete input.exception[field]; assert.equal(evaluateAudits(input).ok, false);
  }
  for (const changes of [{ lock: undefined }, { now: new Date("invalid") },
    { exception: { ...fixture().exception, expires: "invalid" } },
    { exception: { ...fixture().exception, advisory: "https://example.com/advisory" } }]) {
    assert.equal(evaluateAudits({ ...fixture(), ...changes }).ok, false);
  }
});
test("fails closed for missing, network-error, array, version, or contradictory reports", () => {
  const malformed = [{}, { error: { code: "ECONNRESET" } }, { ...audit(), vulnerabilities: [] },
    { ...audit(), auditReportVersion: 3 }, { ...audit(), metadata: { vulnerabilities: { total: 1 } } }];
  for (const report of malformed) {
    for (const target of ["full", "production"]) {
      assert.equal(evaluateAudits({ ...fixture(), [target]: report }).ok, false);
    }
  }
});
test("rejects empty cause/path arrays and unknown cause severity", () => {
  for (const change of [{ nodes: [] }, { via: [] }, { nodes: [null] },
    { via: [{ url: advisory, severity: "unknown" }] }]) {
    const input = fixture(); Object.assign(input.full.vulnerabilities.braces, change);
    assert.equal(evaluateAudits(input).ok, false);
  }
});
test("rejects unknown causes and cycles rather than silently exempting them", () => {
  for (const cause of ["unknown", "parent", "toString"]) {
    const input = fixture(); input.full.vulnerabilities.parent.via = [cause];
    assert.equal(evaluateAudits(input).ok, false);
  }
});
