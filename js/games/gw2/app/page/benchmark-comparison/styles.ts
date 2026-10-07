export interface ComparisonStyle {
  readonly color: string;
  readonly dash: readonly number[];
}

const COLORS = ['#71d6ed', '#ffbf69', '#c5a0ff', '#88df9f', '#ff8fac', '#e7e49b'];
const DASHES: readonly (readonly number[])[] = [[], [9, 4], [2, 4], [10, 4, 2, 4], [14, 5], [4, 3]];

/** Assign contrasting hues and dash patterns by comparison slot, independently of profession colors. */
export function comparisonStyle(slot: number): ComparisonStyle {
  return {
    color: COLORS[slot % COLORS.length]!,
    dash: DASHES[(slot + Math.floor(slot / COLORS.length)) % DASHES.length]!
  };
}

/** Preserve selected builds' identities while filters, visibility, and simulation completion order change. */
export function assignComparisonSlots(keys: Iterable<string>, slots: Map<string, number>): void {
  const selected = new Set(keys);
  for (const key of slots.keys()) if (!selected.has(key)) slots.delete(key);
  const occupied = new Set(slots.values());
  for (const key of selected) {
    if (slots.has(key)) continue;
    let slot = 0;
    while (occupied.has(slot)) slot++;
    slots.set(key, slot);
    occupied.add(slot);
  }
}
