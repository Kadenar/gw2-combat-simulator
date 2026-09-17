/** Defines numeric patch edits independently so simulation configuration does not depend on patch implementation. */
export type NumEdit =
  number | { readonly from: number; readonly to: number } | { readonly multiply: number } | { readonly add: number };
