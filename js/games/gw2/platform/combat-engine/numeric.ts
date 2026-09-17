/**
 * Numeric conversions reproduced from the pinned gw2combat reference.
 *
 * The C++ engine mixes integer division, `std::floor` truncation, and
 * `std::nearbyint` under FE_TONEAREST (round half to even). JavaScript's
 * `Math.round` rounds halves upward, so every rounding site in the port routes
 * through these helpers instead of the built-ins to keep damage and duration
 * arithmetic identical to the reference.
 */

/** `static_cast<int>(std::floor(value))`: used for strike damage and progress ticks. */
export function roundDown(value: number): number {
  return Math.floor(value);
}

/** `std::nearbyint` with banker's rounding: exact halves resolve to the even neighbor. */
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const difference = value - floor;
  if (difference < 0.5) return floor;
  if (difference > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** `round_to_nearest_n_digits`: banker's rounding at a decimal precision. */
export function roundHalfEvenDigits(value: number, digits: number): number {
  const scale = 10 ** digits;
  return roundHalfEven(value * scale) / scale;
}

/**
 * C++ `int / int`: truncates toward zero. Cooldown modifiers can drive progress
 * negative, so flooring would disagree with the reference for negative values.
 */
export function intDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    throw new RangeError('Integer division by zero; the reference build would fault here.');
  }

  return Math.trunc(numerator / denominator);
}

/** `static_cast<int>(double)`: truncates toward zero. */
export function truncateToInt(value: number): number {
  return Math.trunc(value);
}
