import { describe, it, expect } from "vitest";
import { lintFixture, piiFindings, nonPiiFindings, groupByCode, EXPECTED } from "./harness.js";

describe("ruleset fixtures", () => {
  for (const fixture of Object.keys(EXPECTED)) {
    it(`${fixture} matches expected pii-* findings and has zero non-pii diagnostics`, () => {
      const findings = lintFixture(fixture);
      const pii = piiFindings(findings);
      const nonPii = nonPiiFindings(findings);
      expect(groupByCode(pii)).toEqual(EXPECTED[fixture]);
      expect(nonPii).toEqual([]);
    });
  }
});
