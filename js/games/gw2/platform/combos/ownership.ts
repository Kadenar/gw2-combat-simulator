import type { OwnedComboDescriptor } from '#gw2/platform/combos/types.js';

/** Reject unowned declarations at authoring and runtime boundaries so combos cannot silently disappear. */
export function requireComboDescriptorOwner(value: unknown, label: string): OwnedComboDescriptor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }

  const descriptor = value as Record<string, unknown>;
  if (typeof descriptor.ownerId !== 'string' || !descriptor.ownerId.trim()) {
    throw new TypeError(`${label} ownerId must be a non-empty string.`);
  }

  return descriptor as OwnedComboDescriptor;
}

/** Optional descriptor lists may be absent, but every supplied entry must declare its combo owner. */
export function requireOwnedComboDescriptors(value: unknown, label: string): readonly OwnedComboDescriptor[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return value.map((entry, index) => requireComboDescriptorOwner(entry, `${label} entry ${index + 1}`));
}

/** Validate both declaration kinds wherever an effect, tick, or custom packet carries combo metadata. */
export function validateComboOwnership(value: Readonly<Record<string, unknown>>, label: string): void {
  for (const field of ['comboFields', 'comboFinishers']) {
    requireOwnedComboDescriptors(value[field], `${label} ${field}`);
  }
}
