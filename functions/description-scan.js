import { isSuppressed } from "./lib/suppress.js";
import { findTextPii } from "./lib/text-pii.js";
import { findSecrets } from "./lib/secrets.js";

export default (targetVal, _opts, context) => {
  if (isSuppressed(context.document.data, context.path)) return [];
  const text = String(targetVal ?? "");
  const hits = [...findTextPii(text), ...findSecrets(text)];
  if (!hits.length) return [];
  const types = [...new Set(hits.map((h) => h.type))];
  return [{ message: `Description contains PII-shaped values: ${types.join(", ")}` }];
};
