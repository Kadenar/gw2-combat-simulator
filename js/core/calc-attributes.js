import { calculateCommonAttributes } from "../platform/gw2/attributes.js";

// Compatibility path for profession-neutral attribute assembly.
// Profession rules belong in each profession's own calculator.
export function calculateAttributes(build, options = {}) {
  return calculateCommonAttributes(build, options);
}

export const calcAttributes = calculateAttributes;
