import { describe, it, expect } from "vitest";
import { lintFixtureWith, piiFindings } from "./harness.js";

describe("strict preset", () => {
  it("elevates every pii-* finding on dirty-example-contact.yaml to error severity", () => {
    const findings = lintFixtureWith("dirty-example-contact.yaml", "presets/strict.yaml");
    const pii = piiFindings(findings);
    expect(pii.length).toBeGreaterThan(0);
    for (const f of pii) {
      expect(f.severity).toBe(0);
    }
  });
});
