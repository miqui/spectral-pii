import { isSuppressed } from "./lib/suppress.js";

const FORMATS = new Set([
  "email", "ssn", "phone", "telephone", "e164",
  "date-of-birth", "dob", "imei", "ipv4", "ipv6", "iban", "credit-card",
]);

export default (targetVal, _opts, context) => {
  if (isSuppressed(context.document.data, context.path)) return [];
  const value = String(targetVal ?? "");
  if (!FORMATS.has(value)) return [];
  return [{ message: `Schema format "${value}" suggests PII` }];
};
