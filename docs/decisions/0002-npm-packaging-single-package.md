---
title: "ADR-0002: One npm package, default + strict presets, unpublished (v1)"
status: accepted
date: 2026-09-27
owner: miqui
slug: spectral-pii
related:
  - docs/design/spectral-pii-design.md
  - docs/decisions/0001-engine-core-plus-custom-functions.md
---

# ADR-0002: One npm package, default + strict presets, unpublished (v1)

## Context

Consumers need a stable way to `extends` the ruleset. Options:

- **B1** — one npm package containing ruleset + presets + functions
- **B2** — raw YAML on GitHub, no package

## Decision

Adopt **B1** structurally: a single package named `spectral-pii` (fallback `@miqui/spectral-pii`)
containing `ruleset.yaml`, `presets/default.yaml`, `presets/strict.yaml`, and `functions/`.
Consumers:

```yaml
extends: ["spectral-pii"]              # default severities
# or
extends: ["spectral-pii/strict"]       # all error
```

**v1 does NOT publish to npm** (user decision, Checkpoint 3 TBD-5). The repo is npm-ready:
`package.json` ships correct `files`, semver discipline applies to rule changes, but publication
is a separate future gate. Distribution until then: clone + `extends: ["./path/to/ruleset.yaml"]`
or remote-extends for rules-only consumers (no custom-function rules).

## Consequences

- Semver becomes the contract once published; breaking rule changes bump major — start now.
- Preset split gives teams a no-code severity policy (`default` for review, `strict` for CI gates).
- Unpublished status means consumers pin a git revision; acceptable at this scale.

## Alternatives considered

- **B2 (raw YAML only)** — no versioning, remote-extends are fragile in CI, custom functions
  unresolvable. Rejected.

Back-link: governs packaging box in the design doc component map.
