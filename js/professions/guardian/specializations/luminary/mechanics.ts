export const LUMINARY_MECHANICS = Object.freeze({
  radiantForge: Object.freeze({
    // Both weapons share coefficient 1.0; separated here so future tuning
    // doesn't require touching the emit logic in radiant-forge.ts.
    glaringBurstCoefficientByWeapon: Object.freeze({
      hammer: 1,
      blade: 1,
    }),
  }),
});
