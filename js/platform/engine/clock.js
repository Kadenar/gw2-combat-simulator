export const EPSILON = 0.0001;

export function nearlyEqual(left, right, epsilon = EPSILON) {
  return Math.abs(Number(left) - Number(right)) <= epsilon;
}

export function clampTime(value, minimum = 0, maximum = Infinity) {
  return Math.max(minimum, Math.min(maximum, Number(value)));
}
