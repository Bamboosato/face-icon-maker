import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { evaluateAudits, validAudit } from "./security-audit-policy.mjs";

export function parseAuditResult(result, name) {
  if (result.error || ![0, 1].includes(result.status)) {
    throw new Error(`npm audit (${name}) did not complete: ${result.error?.message || result.status}`);
  }
  const report = JSON.parse(result.stdout);
  if (!validAudit(report) || result.status !== (report.metadata.vulnerabilities.total === 0 ? 0 : 1)) {
    throw new Error(`Invalid or inconsistent npm audit (${name}) response`);
  }
  return report;
}

export function runSecurityAudit() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("Run this check with npm run audit:security");
  mkdirSync(resolve(root, ".security-audit"), { recursive: true });
  const reports = {};
  const errors = [];
  for (const [name, args] of [["production", ["--omit=dev"]], ["full", ["--include=dev"]]]) {
    const result = spawnSync(process.execPath, [npmCli, "audit", "--json", ...args], {
      cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024, timeout: 120_000,
    });
    // Retain both reports even if one request fails; never turn a network failure into a pass.
    writeFileSync(resolve(root, `.security-audit/${name}.json`), result.stdout || "{}\n");
    try { reports[name] = parseAuditResult(result, name); }
    catch (error) { errors.push(error.message); }
  }
  if (errors.length) throw new Error(errors.join("; "));
  const exceptionPath = resolve(root, "security-audit-exception.json");
  const exception = existsSync(exceptionPath) ? JSON.parse(readFileSync(exceptionPath, "utf8")) : undefined;
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  const result = evaluateAudits({ ...reports, lock, exception });
  console.log("Production vulnerabilities:", reports.production.metadata.vulnerabilities);
  console.log("All dependency vulnerabilities:", reports.full.metadata.vulnerabilities);
  if (result.excepted.length) {
    console.log(`Temporary dev exception until ${exception.expires}: ${exception.advisory}`);
    console.log(result.excepted.join(", "));
  }
  if (!result.ok) throw new Error(`Blocking audit findings: ${result.blocked.join(", ")}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { runSecurityAudit(); }
  catch (error) { console.error("Security audit failed:", error.message); process.exitCode = 1; }
}
