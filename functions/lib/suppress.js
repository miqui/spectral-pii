export function isSuppressed(document, path) {
  let node = document;
  for (let i = 0; i < path.length; i++) {
    node = node?.[path[i]];
    if (node && typeof node === "object") {
      const xpii = node["x-pii"];
      if (xpii && typeof xpii === "object" && typeof xpii.justification === "string" && xpii.justification.length > 0) {
        return true;
      }
    }
  }
  return false;
}
