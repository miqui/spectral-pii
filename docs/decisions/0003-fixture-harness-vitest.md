---
title: "ADR-0003: Fixture-based assertions over oas3.2/ corpus, harness in vitest"
status: accepted
date: 2026-09-27
owner: miqui
slug: spectral-pii
related:
  - docs/design/spectral-pii-design.md
  - docs/decisions/0001-engine-core-plus-custom-functions.md
  - docs/decisions/0004-x-pii-suppression-extension.md
---

# ADR-0003: Fixture-based assertions over oas3.2/ corpus, harness in vitest

## Context

Rules need regression-proof verification. Options:

- **C1** — fixture-based assertions: clean + per-category dirty docs, expected findings
  (rule IDs, counts, paths) asserted explicitly
- **C2** — snapshot testing of full lint output

Miguel's standing requirement: sample **OpenAPI 3.2-only documents under `oas3.2/`** as the test
corpus.

## Decision

Adopt **C1** with vitest as the runner:

- `oas3.2/clean.yaml` — expects zero PII findings
- ~10 per-category dirty fixtures — each asserts the exact rule IDs that must fire (rule, count,
  JSONPath of finding)
- `suppression.yaml` — `x-pii`-annotated; asserts suppressed findings are absent
- Harness runs the **real Spectral engine** (`@stoplight/spectral-core`) per fixture and diffs
  actual vs expected; unexpected findings fail the suite

All fixture PII uses reserved fake values: `4111 1111 1111 1111` (test card), `555-01-xxxx`
(SSN documentation range), `example.com` addresses, documentation IPs (192.0.2.0/24, 2001:db8::/32).
Fixtures are OAS **3.2 documents only**; ruleset inputs may still be 3.0/3.1 in the wild.

## Consequences

- Explicit expectations double as executable usage documentation.
- New findings in dirty fixtures fail loudly (unlike snapshots) — correct gate behavior.
- CI must run the harness (not just fixture linting) for assertions to hold: GitHub Actions job
  = install → lint `oas3.2/` with the ruleset → `vitest run`, Spectral version pinned.

## Alternatives considered

- **C2 (snapshots)** — rubber-stamps unintended new findings; weaker as a CI gate. Rejected.

Back-link: governs `oas3.2/` + `test/` boxes in the design doc component map.
