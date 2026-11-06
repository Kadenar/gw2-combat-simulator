/** Supplies explicit presentation owners to headless summary and timeline tests. */
export const emptyTimelineSource = { ui: { timelineOccupiedInterval: () => null }, context: {} };

export function professionTimelineSource(profession, specialization) {
  return { ui: profession.ui, context: { catalog: profession.catalog, specialization } };
}
