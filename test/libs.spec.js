import { describe, it, expect } from "vitest";
import { isSuppressed } from "../functions/lib/suppress.js";
import { luhnValid, extractCardNumbers } from "../functions/lib/luhn.js";
import { findSecrets } from "../functions/lib/secrets.js";
import { findTextPii } from "../functions/lib/text-pii.js";

describe("suppress", () => {
  const doc = { a: { "x-pii": { justification: "reviewed" }, v: 1 }, b: { v: 2 } };
  it("suppresses when any ancestor carries a non-empty justification", () => {
    expect(isSuppressed(doc, ["a", "v"])).toBe(true);
  });
  it("does not suppress without x-pii or with empty justification", () => {
    expect(isSuppressed(doc, ["b", "v"])).toBe(false);
    const empty = { n: { "x-pii": { justification: "" }, v: 1 } };
    expect(isSuppressed(empty, ["n", "v"])).toBe(false);
  });
});

describe("luhn", () => {
  it("accepts Luhn-valid, rejects invalid", () => {
    expect(luhnValid("4111111111111111")).toBe(true);
    expect(luhnValid("4111111111111112")).toBe(false);
  });
  it("extracts card numbers from separators-laden strings", () => {
    expect(extractCardNumbers("pay with 4111 1111 1111 1111")[0]).toBe("4111111111111111");
    expect(extractCardNumbers("no card here 12345")).toEqual([]);
  });
});

describe("secrets", () => {
  it("detects jwt / aws key / stripe / bearer", () => {
    const hits = findSecrets("eyJhbG...xIn0.sig", "«redacted:AKIA…»", "«redacted:sk_live_…»");
    expect(hits.map(h => h.type)).toEqual(["jwt", "aws-key", "stripe-key"]);
  });
  it("ignores plain words", () => {
    expect(findSecrets("bearer of good news")).toEqual([]);
  });
});

describe("text-pii", () => {
  it("finds email, ssn, phone in prose", () => {
    const hits = findTextPii("reach jane.doe@example.com or +1 212 555 0142, ssn 555-01-2345");
    expect(hits.map(h => h.type)).toEqual(["email", "phone", "gov-id"]);
  });
});
