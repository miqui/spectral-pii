---
title: spectral-pii Implementation Plan
status: draft-awaiting-approval
date: 2026-09-27
owner: miqui
slug: spectral-pii
related:
  - docs/design/spectral-pii-design.md
  - docs/decisions/0001-engine-core-plus-custom-functions.md
  - docs/decisions/0002-npm-packaging-single-package.md
  - docs/decisions/0003-fixture-harness-vitest.md
  - docs/decisions/0004-x-pii-suppression-extension.md
---

# spectral-pii Implementation Plan

> **For Hermes:** Use subagent-driven-development — dispatch one subagent per task batch, then independently verify child output before reporting each build checkpoint.

**Goal:** Spectral v6 ruleset + custom function pack that flags potential PII in OpenAPI 3.x documents, verified against an OAS-3.2-only fixture corpus.

**Architecture:** One npm-shaped package: `ruleset.yaml` entry defining 13 `pii-*` rules, severity presets (`default`, `strict`), custom JS functions for value/prose scanning with `x-pii` suppression, and a vitest harness that spawns the real Spectral CLI over `oas3.2/` fixtures and asserts exact findings.

**Tech Stack:** Node ≥20, ESM, `@stoplight/spectral-cli` (pinned), vitest, GitHub Actions (keyless).

**Standing constraint — NO git:** do **not** `git init`/commit/push. Repo publication happens later exclusively via `git-workflow.sh` (its `init` requires uncommitted work). Plan steps end at verification, never at commits.

**Design-doc layout refinement (implements ADR-0001 pack; substance unchanged):**
`functions/` holds rule-driver modules + `functions/lib/` shared detectors:

```
ruleset.yaml            presets/default.yaml   presets/strict.yaml
functions/pii-name.js   functions/format-hint.js    functions/pattern-hint.js
functions/example-scanner.js   functions/description-scan.js
functions/server-url.js        functions/security-scheme-scan.js
functions/lib/suppress.js      functions/lib/luhn.js
functions/lib/secrets.js       functions/lib/text-pii.js
oas3.2/*.yaml           test/harness.js  test/expected.json  test/*.spec.js
```

---

## Task 1 — Package scaffold

**Objective:** npm package shell that installs cleanly.

**Files:** Create `package.json`, `.gitignore`, `LICENSE`, `README.md` (stub, finalized in Task 11).

`package.json`:

```json
{
  "name": "spectral-pii",
  "version": "0.1.0",
  "description": "Spectral rulesets to detect potential PII in OpenAPI 3.x documents",
  "type": "module",
  "license": "MIT",
  "engines": { "node": ">=20" },
  "files": ["ruleset.yaml", "presets", "functions"],
  "scripts": {
    "test": "vitest run",
    "lint:clean": "spectral lint oas3.2/clean.yaml"
  },
  "devDependencies": {
    "@stoplight/spectral-cli": "6.16.0",
    "vitest": "^2.1.0"
  }
}
```

`.gitignore`: `node_modules/`. `LICENSE`: MIT, copyright 2026 miqui.

**Verify:** `cd /Users/miqui/development/spectral-pii && npm install && npx spectral --version` → expect `6.16.0` and no install errors.

## Task 2 — Suppression + detector libs (TDD)

**Objective:** Shared building blocks, unit-tested in isolation.

**Files:** Create `functions/lib/suppress.js`, `functions/lib/luhn.js`, `functions/lib/secrets.js`, `functions/lib/text-pii.js`, `test/libs.spec.js`.

**Step 1: failing tests** in `test/libs.spec.js` (vitest, import from `../functions/lib/…`):

```js
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
    const hits = findSecrets("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig", "AKIAIOSFODNN7EXAMPLE", "sk_live_abc123");
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
```

**Step 2:** `npx vitest run test/libs.spec.js` → FAIL (modules missing).

**Step 3: implementations.**

- `suppress.js` — `isSuppressed(document, path)`: for each prefix length `1..path.length`, walk `document` by path prefix; if node has `x-pii` object with non-empty string `justification`, return true. Return false.
- `luhn.js` — `luhnValid(digits)` standard Luhn; `extractCardNumbers(str)`: strip per-candidate separators — match `/(?:\d[ -]?){12,25}\d/g` candidates, remove `[ -]`, keep 13–19 digit strings that pass Luhn and don't consist of a single repeated digit.
- `secrets.js` — `findSecrets(...strings)`: ordered detectors with `{type, pattern}` list:
  - `jwt`: `/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/`
  - `aws-key`: `/AKIA[0-9A-Z]{16}/`
  - `stripe-key`: `/[sp]k_(live|test)_[A-Za-z0-9]{10,}/`
  - `github-token`: `/(ghp|gho|github_pat)_[A-Za-z0-9_]{20,}/`
  - `slack-token`: `/xox[baprs]-[A-Za-z0-9-]{10,}/`
  - `private-key`: `/-----BEGIN [A-Z ]*PRIVATE KEY-----/`
  - `bearer`: `/\bBearer\s+[A-Za-z0-9\-._~+/]{16,}={0,2}/`
  Return array of `{type, match}`.
- `text-pii.js` — `findTextPii(...strings)`: detectors:
  - `email`: `/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/` (matches example.com too — flagged by design)
  - `gov-id`: `/\b\d{3}-\d{2}-\d{4}\b/` (SSN; fixtures use 555-01-xxxx reserved range)
  - `phone`: `/\+\d{1,3}[ .-]?\(?\d{1,4}\)?[ .-]?\d{3}[ .-]?\d{4}\b/` or `/\b\(\d{3}\) ?\d{3}-\d{4}\b/` or `/\b\d{3}-\d{3}-\d{4}\b/`
  Return `[{type, match}]` in detector order.

**Step 4:** `npx vitest run test/libs.spec.js` → PASS (all cases above).

## Task 3 — Ruleset skeleton, presets, clean fixture

**Objective:** 13 rules wired end-to-end; clean doc lints to zero findings.

**Files:** Create `ruleset.yaml`, `presets/default.yaml`, `presets/strict.yaml`, `oas3.2/clean.yaml`, and the 7 custom-function drivers as **initial stubs** (return `[]`) — filled in Tasks 4–6.

`ruleset.yaml`:

```yaml
extends: ["spectral:oas"]
functions:
  - ./functions/pii-name.js
  - ./functions/format-hint.js
  - ./functions/pattern-hint.js
  - ./functions/example-scanner.js
  - ./functions/description-scan.js
  - ./functions/server-url.js
  - ./functions/security-scheme-scan.js
rules:
  pii-property-name:
    description: Property name looks like PII
    given: $..properties[*]
    severity: warn
    then: { function: pii-name }
  pii-format-hint:
    description: Schema format suggests PII
    given: $..format
    severity: warn
    then: { function: format-hint }
  pii-pattern-hint:
    description: Schema pattern suggests PII capture
    given: $..pattern
    severity: warn
    then: { function: pattern-hint }
  pii-example-email:
    description: Example value contains an email address
    given: $..examples[*]
    severity: error
    then: { function: example-scanner, functionOptions: { mode: email } }
  pii-example-phone:
    description: Example value contains a phone number
    given: $..examples[*]
    severity: error
    then: { function: example-scanner, functionOptions: { mode: phone } }
  pii-example-gov-id:
    description: Example value contains a government-ID-shaped string
    given: $..examples[*]
    severity: error
    then: { function: example-scanner, functionOptions: { mode: gov-id } }
  pii-example-address:
    description: Example value contains a street-address-shaped string
    given: $..examples[*]
    severity: error
    then: { function: example-scanner, functionOptions: { mode: address } }
  pii-example-payment-card:
    description: Example value contains a Luhn-valid payment card number
    given: $..examples[*]
    severity: error
    then: { function: example-scanner, functionOptions: { mode: card } }
  pii-example-ip-geo:
    description: Example value contains an IP address or lat/long
    given: $..examples[*]
    severity: info
    then: { function: example-scanner, functionOptions: { mode: ip-geo } }
  pii-secret-in-example:
    description: Example value contains a secret or token
    given: $..examples[*]
    severity: error
    then: { function: example-scanner, functionOptions: { mode: secret } }
  pii-description-pii:
    description: Description prose contains PII-shaped values
    given: $..description
    severity: warn
    then: { function: description-scan }
  pii-credentials-in-server-url:
    description: Server URL embeds credentials (user:pass@host)
    given: $..servers[*].url
    severity: error
    then: { function: server-url }
  pii-security-scheme-credentials:
    description: Security scheme carries embedded credentials
    given: $.components.securitySchemes[*]
    severity: warn
    then: { function: security-scheme-scan }
```

`presets/default.yaml`: `extends: ["../ruleset.yaml"]` (severities as above). `presets/strict.yaml`: extends default, then `rules:` block re-declaring all 13 ids with `severity: error`.

`oas3.2/clean.yaml`: valid OAS **3.2.0** doc — `openapi: 3.2.0`, info (title/summary/version), one server `https://api.example.com/v1` (no userinfo), one tag, one path `/widgets` GET with operationId `listWidgets`, components schema `Widget { id (uuid), label }`, problem-details error response component. **No PII vocabulary, no examples with real-shaped values, no descriptions with emails/phones.**

**Verify:** `npx spectral lint oas3.2/clean.yaml` → exit 0, zero diagnostics (oas rules included).

## Task 4 — Schema-signal functions + fixtures

**Objective:** Naming/format/pattern detection live, fixture-asserted.

**Files:** Fill `functions/pii-name.js`, `functions/format-hint.js`, `functions/pattern-hint.js`; create `oas3.2/dirty-naming.yaml`, `dirty-formats.yaml`, `dirty-patterns.yaml`, `test/expected.json`, `test/harness.js`, `test/ruleset.spec.js`.

**Function semantics (all follow the same skeleton):**

```js
// functions/pii-name.js
import { isSuppressed } from "./lib/suppress.js";
const TOKENS = [ /* vocabulary below */ ];
export default (targetVal, _opts, context) => {
  if (isSuppressed(context.document.data, context.path)) return [];
  const name = String(context.path[context.path.length - 1] ?? "");
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hits = TOKENS.filter(t => norm.includes(t));
  if (!hits.length) return [];
  return [{ message: `Property "${name}" looks like PII (matched: ${hits.join(", ")})` }];
};
```

- `pii-name.js` TOKENS (substring match on normalized name): `ssn, socialsecurity, nationalid, taxid, dob, dateofbirth, birthdate, firstname, lastname, middlename, fullname, maidenname, email, phone, mobile, fax, street, addressline, postalcode, zipcode, passport, driverlicense, driverslicense, creditcard, cardnumber, ccnumber, iban, routingnumber, bankaccount, ipaddress, geo, latitude, longitude, coordinates, medicalrecord, healthrecord, diagnosis, biometric, fingerprint, gender, ethnicity, religion, password, apikey, secrettoken, accesstoken, refreshtoken, privatekey`.
- `format-hint.js`: given targetVal is the format string; FORMATS = `[email, ssn, phone, telephone, e164, date-of-birth, dob, imei, ipv4, ipv6, iban, credit-card]` (exact match). Note: this rule fires on the **clean doc's `format: uuid`?** — no, uuid not in list; clean stays clean.
- `pattern-hint.js`: signatures = [`\\d{3}-\\d{2}-\\d{4}` (SSN), `\\d{4}[ -]?\\d{4}[ -]?\\d{4}` (card grouping), `\\+?\\d{1,3}[ .-)]?\\d{3}` (phone-ish prefix) — flag when pattern source contains any signature].

**Fixtures (OAS 3.2.0, each minimal-valid; reserved fake values only):**

- `dirty-naming.yaml` — components schema `Contact` with properties `first_name`, `date_of_birth`, `credit_card` (+ a clean `id` property). Expected: `pii-property-name ×3`.
- `dirty-formats.yaml` — schema props `contact_email` (`format: email`), `mobile` (`format: phone`), plus one `format: uuid` control. Expected: `pii-format-hint ×2`.
- `dirty-patterns.yaml` — schema prop `id_document` with `pattern: "^\\d{3}-\\d{2}-\\d{4}$"` and prop `card` with `pattern: "^\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}$"`. Expected: `pii-pattern-hint ×2`.

**Harness** (`test/harness.js`): spawns pinned CLI, returns parsed findings.

```js
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(root, "node_modules", ".bin", "spectral");

export function lintFixture(fixture) {
  const file = path.join(root, "oas3.2", fixture);
  try {
    const out = execFileSync(CLI,
      ["lint", file, "--ruleset", path.join(root, "ruleset.yaml"), "-f", "json"],
      { encoding: "utf8" });
    return JSON.parse(out || "[]");
  } catch (err) {
    // spectral exits 1 when findings exist — stdout still carries JSON
    return JSON.parse((err.stdout || "[]"));
  }
}

export function piiFindings(findings) {
  return findings.filter(f => String(f.code).startsWith("pii-"));
}

export const EXPECTED = (await import("./expected.json", { with: { type: "json" } })).default;
```

`test/expected.json`:

```json
{ "clean.yaml": {}, "dirty-naming.yaml": { "pii-property-name": 3 },
  "dirty-formats.yaml": { "pii-format-hint": 2 }, "dirty-patterns.yaml": { "pii-pattern-hint": 2 } }
```

`test/ruleset.spec.js`: iterates `Object.keys(EXPECTED)`; per fixture asserts: (a) grouped `piiFindings` counts deep-equal `EXPECTED[fixture]`; (b) **zero non-`pii-*` diagnostics** (fixtures must be structurally valid OAS 3.2).

**Verify:** `npx vitest run` → PASS for the four fixtures.

## Task 5 — Example-scanner + content fixtures

**Objective:** Value-level scanning of example values across all 7 example modes.

**Files:** Fill `functions/example-scanner.js`; create `dirty-example-contact.yaml`, `dirty-example-payment.yaml`, `dirty-example-secrets.yaml`, `dirty-example-infra.yaml`; extend `expected.json`.

`example-scanner.js` semantics: target = an Example Object (`{value, summary, …}`) **or** a raw schema-level example; resolve payload = object-with-`value` ? `payload.value` : target. If payload is string → scan string with the mode's detector; if object/array → walk recursively (depth-first), scanning every string leaf and checking object keys in `ip-geo` mode (`latitude|longitude|lat|lng|lon` keys with numeric values → hit `lat/long`). Emit one issue per hit: message includes mode type + matched value, `path` = relative offset of the leaf (e.g. `["value", "user", "email"]` relative to the matched node — Spectral appends the rule's `given` path context automatically; return relative path from the targetVal root).

Mode dispatch: `email|phone|gov-id|address` → `findTextPii` filtered by type (address detector: `/\b\d{1,5} [A-Z][a-z]+ (St|Ave|Blvd|Rd|Lane|Ln|Drive|Dr)\b/`); `card` → `extractCardNumbers`; `secret` → `findSecrets`; `ip-geo` → IPv4 `/\b(?!0\.)(?:\d{1,3}\.){3}\d{1,3}\b/` with octet ≤255 validation + IPv6 requiring ≥4 colon-groups or `::` + key-based lat/long. Every detector run wrapped in `isSuppressed` check first.

**Fixtures:**

- `dirty-example-contact.yaml` — POST `/customers` requestBody `application/json` example value `{ "name": "Jane Doe", "email": "jane.doe@example.com", "phone": "+1 212 555 0142", "ssn": "555-01-2345", "street": "1600 Pennsylvania Ave" }`. Expected: `pii-example-email ×1`, `pii-example-phone ×1`, `pii-example-gov-id ×1`, `pii-example-address ×1`, plus `pii-property-name ×4` (name/email/phone/ssn are PII-vocab property names — **include them in expected.json**) and `pii-format-hint ×0`.
- `dirty-example-payment.yaml` — example value `{ "card_number": "4111 1111 1111 1111", "iban": "GB82 WEST 1234 5698 7654 32" }`. Expected: `pii-example-payment-card ×1`, `pii-property-name ×2`.
- `dirty-example-secrets.yaml` — example value `{ "token": "eyJhbG...c2ln", "aws_key": "«redacted:AKIA…»", "api_key": "«redacted:sk_live_…»" }`. Expected: `pii-secret-in-example ×3`, `pii-property-name ×3`. <!-- betterleaks:allow synthetic fixture doubles -->
- `dirty-example-infra.yaml` — example value `{ "ip": "192.0.2.7", "host": "example.com", "location": { "latitude": 38.8977, "longitude": -77.0365 } }`. Expected: `pii-example-ip-geo ×2` (ip + lat/long pair as one? no — detector emits per hit: ip ×1, lat/long ×1 → total ×2), `pii-property-name ×2` (ip, location? — location not in vocab; `ip` is → ×1). Finalize counts by running the harness and pinning actuals into expected.json (this is the intended manifest calibration step; every other count in this plan is pre-asserted — calibrate only if a spec'd detector legitimately differs, and note it).

**Verify:** `npx vitest run` → PASS for eight fixtures.

## Task 6 — Prose/server/securityScheme functions + fixtures

**Files:** Fill `functions/description-scan.js`, `functions/server-url.js`, `functions/security-scheme-scan.js`; create `dirty-descriptions.yaml`, `dirty-server-credentials.yaml`, `dirty-security-scheme.yaml`; extend `expected.json`.

- `description-scan.js`: targetVal string; run `findTextPii` + `findSecrets`; suppressed check via context; message lists types found. (JWT-shaped prose hits are accepted warn-level FPs per design §9.)
- `server-url.js`: regex `:\/\/[^\/@\s]+:[^\/@\s]+@` over targetVal → one issue. Clean doc's `https://api.example.com/v1` must not match.
- `security-scheme-scan.js`: given the scheme object — scan `description`, `name`, `bearerFormat` strings with `findSecrets`; flag literal `username`/`password` keys set to non-empty strings in the scheme object; suppressed check.

**Fixtures:**

- `dirty-descriptions.yaml` — schema description: "Contact support at support@example.com or +1 212 555 0142". Expected: `pii-description-pii ×1`.
- `dirty-server-credentials.yaml` — server `https://ci-user:s3cretToken@example.com/v1`. Expected: `pii-credentials-in-server-url ×1`.
- `dirty-security-scheme.yaml` — `securitySchemes: { basic: { type: http, scheme: basic, description: "Use key AKIAIOSFODNN7EXAMPLE" } }`. Expected: `pii-security-scheme-credentials ×1`.

**Verify:** `npx vitest run` → PASS across all 11 non-suppression fixtures.

## Task 7 — Suppression fixture (ADR-0004)

**Files:** Create `oas3.2/suppression.yaml`; extend `expected.json`.

Fixture: copy of `dirty-example-contact.yaml`'s schema+example **plus** `x-pii: { justification: "fixture: reviewed" }` on the customer schema root and on `phone` property, but **no annotation on `ssn`** (kept at property level to prove node-scoping: annotate `ssn` itself, leave schema unannotated → only `ssn` finding survives if schema annotated? No — semantics: annotation suppresses subtree. Spec the fixture as: `x-pii` on schema root with justification → ALL schema findings suppressed; second schema `Contact2` identical but annotation only on `email` property → email suppressed, `date_of_birth` name-finding still fires).

Expected: `{ "suppression.yaml": { "pii-property-name": 1, "pii-example-gov-id": 0 } }` — exactly one surviving finding; assert `pii-example-email`, `pii-example-phone` absent.

**Verify:** `npx vitest run` → PASS, 12 fixtures total.

## Task 8 — Strict preset verification

**Files:** `test/strict.spec.js`.

Assert: linting `dirty-example-contact.yaml` with `--ruleset presets/strict.yaml` yields every `pii-*` finding at `severity === 0` (error). Add helper `lintFixtureWith(fixture, rulesetPath)` in harness.

**Verify:** `npx vitest run` → PASS.

## Task 9 — GitHub Actions CI

**Objective:** Keyless CI gate on every PR.

**Files:** Create `.github/workflows/ci.yml`.

```yaml
name: ci
on: [pull_request]
jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Lint clean fixture (must be zero findings)
        run: npx spectral lint oas3.2/clean.yaml
      - name: Ruleset harness (fixture assertions)
        run: npm test
```

**Verify:** local `node --check` of YAML by `npx js-yaml .github/workflows/ci.yaml > /dev/null` (or `node -e` with yaml parse) — parse OK; actual CI run validated after publication gate (workflow file shipped ready).

## Task 10 — README + final sweep

**Files:** Replace `README.md` stub.

Sections: What it is · Quickstart (`extends: ["spectral-pii"]` clone-path variant for now, npm variant post-publish) · Rule table (id / severity / detects — the 13 rules from design §5) · Strict preset · `x-pii` suppression (per ADR-0004, with the design §6 snippet) · VS Code extension caveat (custom functions need local package — ADR-0001) · Tested Spectral version (`6.16.0` pinned) · Reserved fake data note (fixtures use Luhn test card, 555-01-xxxx SSNs, example.com, docs IPs — flagged by design; suppression or rule-off for accepted fields) · Development (`npm install && npm test`) · Run manually section (only commands actually executed in the build, with real output) · License MIT.

**Verify (final sweep, all must pass):** `npm test` (12 fixtures green) · `npm run lint:clean` (exit 0) · `node -e "JSON.parse(fs...)"` on expected.json valid · `ls` confirms full tree matches design §4 component map.

---

## Build execution & checkpoints (Phase 3)

Per subagent-driven-development: batches of ~3 tasks per sweep, one subagent per task with full context (this plan's task text + paths + no-git rule + never-persist-masked-credentials warning), two-stage review, **Hermes re-verifies every child claim by re-running the verification commands before reporting each checkpoint.**

- Sweep 1: Tasks 1–3 → checkpoint report
- Sweep 2: Tasks 4–6 → checkpoint report
- Sweep 3: Tasks 7–10 → final report

## TBDs

None — all Checkpoint-3 TBDs resolved (vitest, x-pii yes, MIT, name, no-publish). New TBDs surfaced during build stop the sweep and come back to you.
