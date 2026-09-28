---
title: spectral-pii Design
status: approved
date: 2026-09-27
owner: miqui
slug: spectral-pii
related:
  - docs/decisions/0001-engine-core-plus-custom-functions.md
  - docs/decisions/0002-npm-packaging-single-package.md
  - docs/decisions/0003-fixture-harness-vitest.md
  - docs/decisions/0004-x-pii-suppression-extension.md
  - docs/plans/spectral-pii-plan.md
---

# spectral-pii — Design

Spectral rulesets that capture/detect potential PII in OpenAPI 3.x documents.
Approved via Checkpoints 1–3 (2026-09-27, Slack thread hermes-builder/1790545906.633309).

## 1. Problem

OpenAPI 3.x contracts leak PII through:

- schema **property names** carrying PII vocabulary (`ssn`, `dob`, `firstName`, `street`, `iban`, `creditCard`)
- **format/pattern hints** (`format: email`, `pattern: \d{3}-\d{2}-\d{4}`)
- **realistic example values** — literal emails, phone numbers, SSNs, Luhn-valid card numbers, JWTs, API keys
- **description prose** containing contactable or identifiable values
- **server URLs** with embedded credentials (`https://user:pass@…`)
- **securityScheme definitions** with real-looking defaults

Nothing in a typical CI catches this before the API contract is published. This project ships a
Spectral ruleset that flags *potential* PII at spec-review/CI time, severity-graded and
individually disableable, with an explicit suppression mechanism for reviewed-and-accepted fields.

## 2. Users & use case

- **Primary**: API authors/reviewers running `spectral lint` as a CI gate on OpenAPI 3.x documents.
- **Secondary**: local/editor linting via the Spectral VS Code extension (note: custom JS functions
  require the package installed; see ADR-0001 consequences).

## 3. Approved decisions

| # | Decision | ADR |
|---|----------|-----|
| D1 | Engine: Spectral v6 core functions + small custom JS function pack | ADR-0001 |
| D2 | Packaging: one npm package, default + strict presets, **not published to npm** (v1) | ADR-0002 |
| D3 | Testing: fixture-based assertions over `oas3.2/` corpus, harness in **vitest** | ADR-0003 |
| D4 | Suppression: `x-pii: {justification: …}` extension | ADR-0004 |

Other checkpoint resolutions: MIT license; package name `spectral-pii` (fallback `@miqui/spectral-pii`,
post-MVP); repo publication only on Miguel's explicit go via `git-workflow.sh`; fixtures use OAS **3.2
documents only** under `oas3.2/` (the ruleset still *accepts* 3.0/3.1 as inputs).

## 4. Component map

```
spectral-pii/
├── ruleset.yaml              # entry point: metadata, extends presets, all pii-* rules
├── presets/
│   ├── default.yaml          # severities as listed in §5
│   └── strict.yaml           # everything error (CI-fail posture)
├── functions/
│   ├── luhn.js               # Luhn-valid card numbers in values
│   ├── secrets.js            # JWT / API-key / bearer-shaped strings
│   └── text-pii.js           # email/phone/gov-id/address scan in prose
├── oas3.2/                   # fixture corpus (OAS 3.2 documents ONLY)
├── test/                     # vitest harness + expected-findings manifest
├── .github/workflows/ci.yml  # lint fixtures + run harness on every PR
└── docs/                     # this tree
```

## 5. Rule inventory (v1 — 13 rules)

Schema signals (built-in Spectral functions):

| Rule ID | Severity (default) | given (target) | Detects |
|---|---|---|---|
| `pii-property-name` | warn | schema properties | PII vocabulary in property names |
| `pii-format-hint` | warn | schema `format` | PII-bearing formats (`email`, `ssn`, `phone`, `date-of-birth`) |
| `pii-pattern-hint` | warn | schema `pattern` | regexes shaped like PII (SSN, phone, card patterns) |

Content scanning (custom functions, applied to examples/descriptions/servers/securitySchemes):

| Rule ID | Severity (default) | Detects |
|---|---|---|
| `pii-example-email` | error | literal email addresses in example values |
| `pii-example-phone` | error | phone numbers in example values |
| `pii-example-gov-id` | error | SSN/national-ID-shaped strings in examples |
| `pii-example-address` | error | street-address-shaped values in examples |
| `pii-example-payment-card` | error | Luhn-valid card numbers |
| `pii-example-ip-geo` | info | IP addresses, lat/long pairs |
| `pii-secret-in-example` | error | JWTs (`eyJ…`), `sk_live_`, `AKIA…`, bearer strings |
| `pii-description-pii` | warn | emails/phones/SSNs inside description prose |
| `pii-credentials-in-server-url` | error | `user:pass@` in `servers[].url` |
| `pii-security-scheme-credentials` | warn | credentials in securityScheme defaults/descriptions |

Design properties:

- Every rule individually disableable (`rules: {pii-example-ip-geo: "off"}`).
- `strict` preset: all rules at `error` for CI-fail posture.
- Deliberately heuristic — flags **potential** PII for human review. False positives on generic
  `email` fields are by design (warn level, suppressible via D4).

## 6. Suppression (D4 → ADR-0004)

```yaml
properties:
  contactEmail:
    type: string
    format: email
    x-pii:
      justification: "Public support contact, reviewed 2026-09-27"
```

- Non-empty `justification` under `x-pii` ⇒ `pii-*` findings under that node are suppressed.
- Suppression is **scoped to the annotated node and its subtree**.
- Aligned with the `x-pii` vocabulary used by Miguel's `openapi-api-designer` agent assets.

## 7. Fixture corpus & harness (D3 → ADR-0003)

- `oas3.2/clean.yaml` — valid OAS 3.2, zero PII, zero expected findings.
- Per-category dirty fixtures (`dirty-naming.yaml`, `dirty-formats.yaml`, `dirty-patterns.yaml`,
  `dirty-example-contact.yaml`, `dirty-example-payment.yaml`, `dirty-example-secrets.yaml`,
  `dirty-example-infra.yaml`, `dirty-descriptions.yaml`, `dirty-server-credentials.yaml`,
  `dirty-security-scheme.yaml`) — each expects exact rule IDs fired (count + paths).
- `suppression.yaml` — annotated with `x-pii`; expects suppressed findings absent.
- All fixture data uses **reserved fake values**: `4111 1111 1111 1111` test card, `555-01-xxxx`
  SSN range, `example.com` emails, documentation-reserved IPs (192.0.2.0/24, 2001:db8::/32).
- Harness: vitest runs the real Spectral engine per fixture and diffs actual vs expected findings.
- CI (GitHub Actions): pinned Spectral CLI version; job = install → lint all `oas3.2/` fixtures →
  run vitest suite. Keyless, on every PR.

## 8. Out of scope (v1)

AsyncAPI/GraphQL; NLP entity resolution; auto-redaction of specs; OAS 2.0; npm publish;
repo publication (gated on explicit go).

## 9. Risks & accepted tradeoffs

- **False positives by design** — heuristic detection; mitigated by severity grading + x-pii.
- **JWT-shaped strings in prose** (docs *explaining* JWTs) may trip `pii-description-pii` —
  accepted, warn-level.
- **VS Code extension ergonomics** — custom functions need the package locally (ADR-0001);
  raw-YAML-only consumers lose content-scan rules.
- **Spectral version drift** — pinned in CI; README documents the tested version.

## 10. Traceability

- ADRs: 0001 (engine), 0002 (packaging), 0003 (fixtures+vitest), 0004 (x-pii suppression).
- Plan: `docs/plans/spectral-pii-plan.md` (Phase 2 gate) links this doc + all ADRs.
