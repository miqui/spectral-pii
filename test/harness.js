import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(root, "node_modules", ".bin", "spectral");

export function lintFixture(fixture, rulesetPath) {
  const file = path.join(root, "oas3.2", fixture);
  const ruleset = rulesetPath ? path.resolve(root, rulesetPath) : path.join(root, "ruleset.yaml");
  try {
    const out = execFileSync(CLI, ["lint", file, "--ruleset", ruleset, "-f", "json"], {
      encoding: "utf8",
    });
    return JSON.parse(out || "[]");
  } catch (err) {
    // spectral exits 1 when findings exist — stdout still carries JSON
    return JSON.parse(err.stdout || "[]");
  }
}

export function lintFixtureWith(fixture, rulesetPath) {
  return lintFixture(fixture, rulesetPath);
}

export function piiFindings(findings) {
  return findings.filter((f) => String(f.code).startsWith("pii-"));
}

export function nonPiiFindings(findings) {
  return findings.filter((f) => !String(f.code).startsWith("pii-"));
}

export function groupByCode(findings) {
  const grouped = {};
  for (const f of findings) {
    grouped[f.code] = (grouped[f.code] || 0) + 1;
  }
  return grouped;
}

export const EXPECTED = (await import("./expected.json", { with: { type: "json" } })).default;
