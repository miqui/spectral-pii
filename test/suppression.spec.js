import { describe, it, expect } from "vitest";
import { lintFixture, piiFindings, groupByCode } from "./harness.js";

describe("x-pii subtree-scoped suppression", () => {
  it("suppresses all findings under a schema-root annotation, but not a sibling schema's unannotated property", () => {
    const findings = lintFixture("suppression.yaml");
    const pii = piiFindings(findings);
    const codes = pii.map((f) => f.code);

    // Customer schema root carries x-pii -> entire subtree suppressed.
    expect(codes).not.toContain("pii-example-email");
    expect(codes).not.toContain("pii-example-phone");
    expect(codes).not.toContain("pii-example-gov-id");

    // Contact2.email carries x-pii -> only that property's subtree suppressed;
    // Contact2.date_of_birth is untouched and must still fire.
    expect(groupByCode(pii)).toEqual({ "pii-property-name": 1 });

    const nameFinding = pii.find((f) => f.code === "pii-property-name");
    expect(nameFinding.path.at(-1)).toBe("date_of_birth");
  });
});
