const DETECTORS = [
  { type: "jwt", pattern: /eyJ[A-Za-z0-9_.-]{10,}/g },
  { type: "aws-key", pattern: /AKIA[0-9A-Z]{0,16}/g },
  { type: "stripe-key", pattern: /[sp]k_(live|test)_[A-Za-z0-9]{0,}/g },
  { type: "github-token", pattern: /(ghp|gho|github_pat)_[A-Za-z0-9_]{20,}/g },
  { type: "slack-token", pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { type: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { type: "bearer", pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]{16,}={0,2}/g },
];

export function findSecrets(...strings) {
  const hits = [];
  for (const str of strings) {
    if (typeof str !== "string") continue;
    const found = [];
    for (const { type, pattern } of DETECTORS) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(str)) !== null) {
        found.push({ type, match: m[0], index: m.index });
        if (m[0].length === 0) pattern.lastIndex++;
      }
    }
    found.sort((a, b) => a.index - b.index);
    for (const f of found) hits.push({ type: f.type, match: f.match });
  }
  return hits;
}
