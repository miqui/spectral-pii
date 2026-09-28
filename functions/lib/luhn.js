export function luhnValid(digits) {
  const str = String(digits).replace(/\D/g, "");
  if (!str.length) return false;
  let sum = 0;
  let alt = false;
  for (let i = str.length - 1; i >= 0; i--) {
    let n = parseInt(str[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function extractCardNumbers(str) {
  const results = [];
  const candidates = String(str).match(/(?:\d[ -]?){12,25}\d/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/[ -]/g, "");
    if (digits.length < 13 || digits.length > 19) continue;
    if (/^(\d)\1+$/.test(digits)) continue;
    if (!luhnValid(digits)) continue;
    results.push(digits);
  }
  return results;
}
