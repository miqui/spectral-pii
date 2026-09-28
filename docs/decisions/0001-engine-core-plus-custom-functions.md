---
title: "ADR-0001: Spectral v6 core functions + custom JS function pack"
status: accepted
date: 2026-09-27
owner: miqui
slug: spectral-pii
related:
  - docs/design/spectral-pii-design.md
  - docs/decisions/0002-npm-packaging-single-package.md
---

# ADR-0001: Spectral v6 core functions + custom JS function pack

## Context

The ruleset must detect PII signals in OpenAPI 3.x documents. Candidate engines:

- **A1** — Spectral v6 built-in functions + a small pack of custom JS functions
- **A2** — Spectral built-ins only, zero JS
- **A3** — bespoke linter wrapping Spectral

Spectral v6 (`@stoplight/spectral-cli` 6.16+) lints OAS 3.0/3.1/3.2 and supports custom rulesets
and custom functions — single established dependency, native CI/extension integration.

## Decision

Adopt **A1**. Built-in functions (`pattern`, `casing`, `truthy`, `enumeration`) implement the
naming/format/pattern rules. A pack of 2–3 custom JS functions implements what core cannot:

- `luhn.js` — Luhn-valid payment-card numbers in example values
- `secrets.js` — JWT (`eyJ…`), `sk_live_`, `AKIA…`, bearer-shaped strings
- `text-pii.js` — email/phone/gov-id/address scanning inside descriptions and example values

## Consequences

- Single runtime dependency chain (`@stoplight/spectral-*`); plain Spectral ruleset semantics.
- Content-aware detection catches the highest-value leaks (real card numbers, live-shaped keys)
  that pure YAML rules cannot.
- Custom functions require consumers to resolve the package (npm install or repo clone) — the
  Spectral VS Code extension cannot execute them from a bare remote YAML extend. Documented in README.
- Functions stay dependency-light (regex + Luhn check, no NLP), keeping the audit surface small.

## Alternatives considered

- **A2 (core only)** — simplest, works everywhere with zero installs, but no Luhn, no value-level
  scanning; misses literal secrets in examples — the primary leak class. Rejected.
- **A3 (bespoke wrapper)** — doubles maintenance surface, no detection gain, loses native
  extension/CI integration. Rejected.

Back-link: governs `functions/` box in the design doc component map.
