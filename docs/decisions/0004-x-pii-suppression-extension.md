---
title: "ADR-0004: x-pii justification extension for suppression"
status: accepted
date: 2026-09-27
owner: miqui
slug: spectral-pii
related:
  - docs/design/spectral-pii-design.md
  - docs/decisions/0001-engine-core-plus-custom-functions.md
---

# ADR-0004: x-pii justification extension for suppression

## Context

Heuristic PII detection produces false positives by design (e.g. a genuinely public
`supportEmail` field). Teams need a documented, reviewable way to accept flagged fields without
turning rules off globally.

## Decision

Support an `x-pii` extension object; a **non-empty `justification`** suppresses `pii-*` findings
under the annotated node and its subtree:

```yaml
contactEmail:
  type: string
  format: email
  x-pii:
    justification: "Public support contact, reviewed 2026-09-27"
```

- Applied per node; inherits to properties/nested examples beneath it.
- Missing or empty `justification` ⇒ no suppression (an bare `x-pii: {}` changes nothing).
- Vocabulary aligned with the `x-pii` extension already used in Miguel's
  `openapi-api-designer` agent assets (same key, compatible shape).
- Custom functions and rulesets check ancestors for `x-pii.justification` before emitting.

## Consequences

- Suppressions live in the spec — visible in review, greppable in audit, no external config.
- Reviewers can lint for unreviewed suppressions later (e.g. a rule flagging empty justifications)
  — natural v2 candidate, out of scope v1.
- Slight runtime cost: ancestor walk per candidate finding (trivial at spec scale).

## Alternatives considered

- Spectral-native per-rule `severity: off` overrides — global, loses per-field context.
- Separate ignore-file config — hides acceptance from the contract itself. Rejected.

Back-link: governs suppression semantics in design doc §6.
