import { isSuppressed } from "./lib/suppress.js";
import { findTextPii } from "./lib/text-pii.js";
import { findSecrets } from "./lib/secrets.js";
import { extractCardNumbers } from "./lib/luhn.js";

const ADDRESS_RE = /\b\d{1,5} [A-Z][a-z]+ (St|Ave|Blvd|Rd|Lane|Ln|Drive|Dr)\b/;
const IPV4_RE = /\b(?!0\.)(?:\d{1,3}\.){3}\d{1,3}\b/g;
const LATLNG_KEYS = /^(latitude|longitude|lat|lng|lon)$/i;

function isValidIpv4(candidate) {
  return candidate.split(".").every((octet) => Number(octet) <= 255);
}

function isValidIpv6(candidate) {
  if (candidate.includes("::")) return true;
  return candidate.split(":").length >= 4;
}

function scanStringForMode(str, mode) {
  const hits = [];
  if (typeof str !== "string") return hits;
  switch (mode) {
    case "email":
    case "phone":
    case "gov-id": {
      for (const h of findTextPii(str)) {
        if (h.type === mode) hits.push({ type: mode, match: h.match });
      }
      break;
    }
    case "address": {
      const m = str.match(ADDRESS_RE);
      if (m) hits.push({ type: "address", match: m[0] });
      break;
    }
    case "card": {
      for (const card of extractCardNumbers(str)) {
        hits.push({ type: "card", match: card });
      }
      break;
    }
    case "secret": {
      for (const h of findSecrets(str)) {
        hits.push({ type: h.type, match: h.match });
      }
      break;
    }
    case "ip-geo": {
      let m;
      IPV4_RE.lastIndex = 0;
      while ((m = IPV4_RE.exec(str)) !== null) {
        if (isValidIpv4(m[0])) hits.push({ type: "ipv4", match: m[0] });
      }
      const ipv6Candidates = str.match(/\b[0-9A-Fa-f:]{4,}\b/g) || [];
      for (const c of ipv6Candidates) {
        if (c.includes(":") && isValidIpv6(c)) hits.push({ type: "ipv6", match: c });
      }
      break;
    }
    default:
      break;
  }
  return hits;
}

function walk(node, mode, relPath, results) {
  if (node == null) return;
  if (typeof node === "string") {
    for (const hit of scanStringForMode(node, mode)) {
      results.push({ path: relPath, hit });
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => walk(item, mode, [...relPath, i], results));
    return;
  }
  if (typeof node === "object") {
    if (mode === "ip-geo") {
      const latLngKeys = Object.keys(node).filter((k) => LATLNG_KEYS.test(k) && typeof node[k] === "number");
      if (latLngKeys.length) {
        results.push({ path: relPath, hit: { type: "lat/long", match: latLngKeys.map((k) => `${k}=${node[k]}`).join(",") } });
      }
    }
    for (const [key, value] of Object.entries(node)) {
      walk(value, mode, [...relPath, key], results);
    }
  }
}

export default (targetVal, opts, context) => {
  if (isSuppressed(context.document.data, context.path)) return [];
  const mode = opts?.mode;
  if (!mode) return [];

  const payload =
    targetVal && typeof targetVal === "object" && !Array.isArray(targetVal) && "value" in targetVal
      ? targetVal.value
      : targetVal;
  const basePath = targetVal && typeof targetVal === "object" && !Array.isArray(targetVal) && "value" in targetVal
    ? ["value"]
    : [];

  const results = [];
  walk(payload, mode, basePath, results);

  const seen = new Set();
  const issues = [];
  for (const { path, hit } of results) {
    const key = `${hit.type}:${hit.match}:${path.join(".")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push({
      message: `Example value contains ${hit.type}-shaped data: ${hit.match} (at ${path.join(".")})`,
    });
  }
  if (!issues.length) return [];
  return issues;
};
