import { isSuppressed } from "./lib/suppress.js";

const SIGNATURES = [
  "\\d{3}-\\d{2}-\\d{4}",
  "\\d{4}[ -]?\\d{4}[ -]?\\d{4}",
  "\\+?\\d{1,3}[ .-)]?\\d{3}",
];

export default (targetVal, _opts, context) => {
  if (isSuppressed(context.document.data, context.path)) return [];
  const value = String(targetVal ?? "");
  const hits = SIGNATURES.filter((sig) => value.includes(sig));
  if (!hits.length) return [];
  return [{ message: `Schema pattern "${value}" suggests PII capture` }];
};
