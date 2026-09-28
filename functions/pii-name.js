import { isSuppressed } from "./lib/suppress.js";

const TOKENS = [
  "ssn", "socialsecurity", "nationalid", "taxid", "dob", "dateofbirth", "birthdate",
  "firstname", "lastname", "middlename", "fullname", "maidenname",
  "email", "phone", "mobile", "fax",
  "street", "addressline", "postalcode", "zipcode",
  "passport", "driverlicense", "driverslicense",
  "creditcard", "cardnumber", "ccnumber", "iban", "routingnumber", "bankaccount",
  "ipaddress", "geo", "latitude", "longitude", "coordinates",
  "medicalrecord", "healthrecord", "diagnosis", "biometric", "fingerprint",
  "gender", "ethnicity", "religion",
  "password", "apikey", "secrettoken", "accesstoken", "refreshtoken", "privatekey",
];

export default (targetVal, _opts, context) => {
  if (isSuppressed(context.document.data, context.path)) return [];
  const name = String(context.path[context.path.length - 1] ?? "");
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hits = TOKENS.filter((t) => norm.includes(t));
  if (!hits.length) return [];
  return [{ message: `Property "${name}" looks like PII (matched: ${hits.join(", ")})` }];
};
