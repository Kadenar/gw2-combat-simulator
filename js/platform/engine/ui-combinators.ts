/**
 * Pure slice-merge combinators shared by the runtime (`composeModuleUi`) and
 * application (`createProfessionFamilyUi`) UI composition. Each folder is order-
 * agnostic and only knows how to combine an ordered list of UI slices for one
 * callback; the selection strategy (which slices, in what order, and any
 * post-processing) stays with each caller.
 */
export type UiSliceLike = Readonly<Record<string, unknown>>;

type UiCallback = (...args: unknown[]) => unknown;

/** Concatenates every slice's list result for `name`, skipping non-owners. */
export function mergeUiList(
  slices: readonly UiSliceLike[],
  name: string,
  args: readonly unknown[],
): unknown[] {
  return slices.flatMap((slice) => {
    const callback = slice[name];
    return typeof callback === "function"
      ? ((callback as UiCallback)(...args) as unknown[]) || []
      : [];
  });
}

/**
 * Returns the first slice result that satisfies `isMatch`, or `fallback` when
 * no owner matches. Callers pass already-reversed slices when later slices win.
 */
export function firstUiMatch(
  slices: readonly UiSliceLike[],
  name: string,
  args: readonly unknown[],
  isMatch: (result: unknown) => boolean,
  fallback: unknown,
): unknown {
  for (const slice of slices) {
    const callback = slice[name];
    if (typeof callback !== "function") continue;
    const result = (callback as UiCallback)(...args);
    if (isMatch(result)) return result;
  }
  return fallback;
}

/** True when any owning slice's result satisfies `isTrue`. */
export function someUiSlice(
  slices: readonly UiSliceLike[],
  name: string,
  args: readonly unknown[],
  isTrue: (result: unknown) => boolean,
): boolean {
  return slices.some((slice) => {
    const callback = slice[name];
    return typeof callback === "function"
      && isTrue((callback as UiCallback)(...args));
  });
}

/** True unless some owning slice's result fails `isAllowed`. Non-owners pass. */
export function everyUiSlice(
  slices: readonly UiSliceLike[],
  name: string,
  args: readonly unknown[],
  isAllowed: (result: unknown) => boolean,
): boolean {
  return slices.every((slice) => {
    const callback = slice[name];
    return typeof callback !== "function"
      || isAllowed((callback as UiCallback)(...args));
  });
}
