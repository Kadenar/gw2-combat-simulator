/** Percentage assertions compare mechanic intent across build-dependent point capacities, ignoring float noise. */
export function lifeForcePercent(pool, value = pool.value) {
  return Number(((value * 100) / pool.maximum).toFixed(10));
}
