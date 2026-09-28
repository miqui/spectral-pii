import { isSuppressed } from "./lib/suppress.js";
import { findSecrets } from "./lib/secrets.js";

export default (targetVal, _opts, context) => {
  if (isSuppressed(context.document.data, context.path)) return [];
  if (!targetVal || typeof targetVal !== "object") return [];

  const messages = [];
  const stringsToScan = [targetVal.description, targetVal.name, targetVal.bearerFormat].filter(
    (v) => typeof v === "string",
  );
  for (const str of stringsToScan) {
    const hits = findSecrets(str);
    for (const h of hits) {
      messages.push(`Security scheme contains a secret (${h.type})`);
    }
  }

  for (const key of ["username", "password"]) {
    if (typeof targetVal[key] === "string" && targetVal[key].length > 0) {
      messages.push(`Security scheme carries embedded credential field "${key}"`);
    }
  }

  if (!messages.length) return [];
  return [{ message: messages.join("; ") }];
};
