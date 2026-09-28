const DETECTORS = [
  { type: "email", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { type: "gov-id", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    type: "phone",
    pattern: /(\+\d{1,3}[ .-]?\(?\d{1,4}\)?[ .-]?\d{3}[ .-]?\d{4}\b)|(\(\d{3}\) ?\d{3}-\d{4})|(\b\d{3}-\d{3}-\d{4}\b)/g,
  },
];

export function findTextPii(...strings) {
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
