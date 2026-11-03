/** Snapshot owned Core and active-specialization fields for tests, independently of public planning projections. */
export function snapshotProfessionState(professionState) {
  return structuredClone({ ...professionState.core, ...professionState.specialization.state });
}
