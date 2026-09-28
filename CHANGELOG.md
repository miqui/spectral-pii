# Changelog

All notable changes to this project are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); SEMVER applied.

## [0.1.0] - 2026-09-27

### Added

- Spectral ruleset with 13 `pii-*` rules detecting potential PII in OpenAPI 3.x documents
  (schema naming/format/pattern signals + content scans of examples, descriptions,
  server URLs, and security schemes)
- Severity presets: default and strict (all rules at error)
- `x-pii: {justification: …}` subtree-scoped suppression (ADR-0004)
- Custom function pack: Luhn card validation, secret/token scanners, text PII scanners
- `oas3.2/` fixture corpus (clean, per-category dirty, suppression) with reserved fake data
- vitest harness asserting exact findings per fixture against the real Spectral CLI (6.16.0)
- Keyless GitHub Actions CI on pull requests
