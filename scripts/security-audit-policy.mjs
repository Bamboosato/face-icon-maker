// Adapted from tennis-organizing-app: production is always strict; a future
// reviewed dev exception must match its advisory, version, path, and expiry.
const severities = ["info", "low", "moderate", "high", "critical"];
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = value => typeof value === "string" && value.trim().length > 0;

export function validAudit(report) {
  if (!object(report) || report.auditReportVersion !== 2 || report.error ||
      !object(report.vulnerabilities) || !object(report.metadata?.vulnerabilities)) return false;
  const totals = report.metadata.vulnerabilities;
  const counts = Object.fromEntries(severities.map(severity => [severity, 0]));
  for (const item of Object.values(report.vulnerabilities)) {
    if (!object(item) || !Object.hasOwn(counts, item.severity) ||
        !Array.isArray(item.nodes) || item.nodes.length === 0 || !item.nodes.every(nonempty) ||
        !Array.isArray(item.via) || item.via.length === 0 ||
        !item.via.every(cause => nonempty(cause) ||
          (object(cause) && nonempty(cause.url) && severities.includes(cause.severity)))) return false;
    counts[item.severity]++;
  }
  return Object.entries(counts).every(([key, value]) => totals[key] === value) &&
    totals.total === Object.keys(report.vulnerabilities).length;
}

export function evaluateAudits({ full, production, lock, exception, now = new Date() }) {
  if (!validAudit(full) || !validAudit(production)) {
    return { ok: false, blocked: ["Invalid or unavailable npm audit response"], excepted: [] };
  }
  const blocked = Object.keys(production.vulnerabilities).map(name => `production: ${name}`);
  const excepted = [];
  const expiration = Date.parse(exception?.expires);
  const active = Number.isFinite(expiration) && Number.isFinite(now.getTime()) && now.getTime() < expiration &&
    nonempty(exception?.owner) && nonempty(exception?.reason) && object(exception?.packages) &&
    /^https:\/\/github\.com\/advisories\/GHSA-[a-z0-9-]+$/.test(exception?.advisory);
  function allowed(name, seen = new Set()) {
    const item = Object.hasOwn(full.vulnerabilities, name) ? full.vulnerabilities[name] : undefined;
    if (!active || !item || seen.has(name) || !Object.hasOwn(exception.packages, name) ||
        !nonempty(exception.packages[name]) || item.severity === "critical") return false;
    if (!item.nodes.every(path => path === `node_modules/${name}` &&
        lock?.packages?.[path]?.dev === true &&
        lock.packages[path].version === exception.packages[name])) return false;
    const visited = new Set(seen).add(name);
    return item.via.every(cause => typeof cause === "string"
      ? allowed(cause, visited)
      : cause.url === exception.advisory && cause.severity !== "critical");
  }
  for (const name of Object.keys(full.vulnerabilities)) {
    if (allowed(name)) excepted.push(name);
    else blocked.push(`full: ${name}`);
  }
  return { ok: blocked.length === 0, blocked, excepted };
}
