# spectral-pii

Spectral ruleset + custom function pack that flags potential PII in OpenAPI 3.x documents,
verified against an OAS-3.2-only fixture corpus.

## What it is

A single npm-shaped package (`ruleset.yaml` + `presets/` + `functions/`) that plugs into
[Spectral](https://github.com/stoplightio/spectral) (pinned `6.16.0`) as a custom ruleset.
It defines 13 `pii-*` rules driven by custom JS functions that inspect property names, schema
`format`/`pattern`, example values, description prose, server URLs, and security-scheme
definitions for PII-shaped or secret-shaped content — plus a `vitest` harness that spawns the
real Spectral CLI over `oas3.2/` fixtures and asserts exact findings.

## Quickstart

Clone-path variant (works today, no publish required):

```yaml
extends: ["/absolute/or/relative/path/to/spectral-pii/ruleset.yaml"]
```

npm variant (once published):

```yaml
extends: ["spectral-pii"]
```

```
npx spectral lint your-api.yaml --ruleset ruleset.yaml
```

## Rule table

| id | severity (default) | detects |
| --- | --- | --- |
| `pii-property-name` | warn | property name matches PII vocabulary (ssn, email, dob, …) |
| `pii-format-hint` | warn | schema `format` suggests PII (`email`, `ssn`, `phone`, `iban`, …) |
| `pii-pattern-hint` | warn | schema `pattern` shaped like SSN / card grouping / phone prefix |
| `pii-example-email` | error | example value contains an email address |
| `pii-example-phone` | error | example value contains a phone number |
| `pii-example-gov-id` | error | example value contains a government-ID-shaped string (SSN) |
| `pii-example-address` | error | example value contains a street-address-shaped string |
| `pii-example-payment-card` | error | example value contains a Luhn-valid payment card number |
| `pii-example-ip-geo` | info | example value contains an IP address or lat/long pair |
| `pii-secret-in-example` | error | example value contains a secret or token (JWT, AWS key, Stripe key, …) |
| `pii-description-pii` | warn | description prose contains PII-shaped values |
| `pii-credentials-in-server-url` | error | server URL embeds `user:pass@host` credentials |
| `pii-security-scheme-credentials` | warn | security scheme carries embedded credentials |

## Strict preset

`presets/strict.yaml` extends the default ruleset and elevates every `pii-*` rule to
`severity: error`, so any hit fails CI/lint gates that only fail on errors:

```
npx spectral lint your-api.yaml --ruleset node_modules/spectral-pii/presets/strict.yaml
```

## `x-pii` suppression (ADR-0004)

Annotate any node with a non-empty `justification` to suppress `pii-*` findings for that node
and its entire subtree:

```yaml
contactEmail:
  type: string
  format: email
  x-pii:
    justification: "Public support contact, reviewed 2026-09-27"
```

- Suppression is subtree-scoped: annotating a schema root suppresses every `pii-*` finding
  below it; annotating a single property only suppresses that property's subtree, leaving
  sibling properties fully checked.
- Missing or empty `justification` (`x-pii: {}`) does **not** suppress anything.
- See `oas3.2/suppression.yaml` / `test/suppression.spec.js` for the fixture proving both scopes.

## VS Code extension caveat

The Spectral VS Code extension bundles its own Spectral runtime and does not resolve local
`functions:` modules the way the CLI does with a project-relative `node_modules`. Because this
ruleset ships custom JS functions (not JSON-only rules), editor-integrated linting requires the
package to be installed as a real npm dependency in the target project (see ADR-0001) — cloning
the repo alone is not enough for in-editor squiggles, only for CLI/CI usage.

## Tested Spectral version

Pinned to `@stoplight/spectral-cli@6.16.0`. Ruleset targets OAS 3.2 documents; no OAS 3.2 schema
validator ships in this Spectral version, so `oas3-schema` is turned off in `ruleset.yaml`
(the custom `pii-*` rules are unaffected).

## Reserved fake data note

Fixtures use only reserved/non-routable placeholder data so nothing resembling a real identity
or credential lives in this repo:

- Payment card: the standard Luhn-valid test number `4111 1111 1111 1111`.
- SSNs: the `555-01-xxxx` reserved range (never issued).
- Emails/domains: `example.com` (RFC 2606 reserved).
- IPs: `TEST-NET` / documentation ranges (e.g. `192.0.2.0/24`).
- Secrets: obviously-fake placeholder strings, several wrapped as `«redacted:…»`.

These are all *intended* to be flagged by the ruleset — that's what the fixtures test. If a
field like this appears deliberately in a real spec (e.g. a documented example that's genuinely
public), suppress it with `x-pii` rather than disabling the rule globally.

## Development

```
npm install
npm test
npm run lint:clean
```

## Run manually

Commands actually executed during this build, with their real observed output:

```
$ npx vitest run
 Test Files  4 passed (4)
      Tests  21 passed (21)

$ npx spectral lint oas3.2/clean.yaml
No results with a severity of 'error' found!
$ echo $?
0

$ npx spectral --version
6.16.0
```

## License

MIT
