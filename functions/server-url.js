import { isSuppressed } from "./lib/suppress.js";

const CREDENTIAL_URL_RE = /:\/\/[^/@\s]+:[^/@\s]+@/;

export default (targetVal, _opts, context) => {
  if (isSuppressed(context.document.data, context.path)) return [];
  const url = String(targetVal ?? "");
  if (!CREDENTIAL_URL_RE.test(url)) return [];
  return [{ message: "Server URL embeds credentials (user:pass@host)" }];
};
