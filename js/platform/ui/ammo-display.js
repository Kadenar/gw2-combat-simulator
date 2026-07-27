/**
 * Normalizes charge counts into a renderer-agnostic ammo view.
 * Returns null for non-ammo skills instead of a zero-length indicator.
 */
export function ammoDisplayView(charges, maximum) {
  const normalizedMaximum = Math.max(0, Math.floor(Number(maximum) || 0));
  if (!normalizedMaximum) return null;

  const current = Math.max(
    0,
    Math.min(normalizedMaximum, Math.floor(Number(charges) || 0)),
  );

  return {
    current,
    maximum: normalizedMaximum,
    available: current > 0,
    label: `${current}/${normalizedMaximum} ammo`,
    // Boolean pips let HTML, canvas, and tests choose their own presentation.
    pips: Array.from(
      { length: normalizedMaximum },
      (_, index) => index < current,
    ),
  };
}
