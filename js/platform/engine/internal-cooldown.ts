/**
 * Internal cooldowns remain active through their recorded boundary timestamp.
 * A proc at exactly readyAt is blocked; only a later timestamp may trigger it.
 *
 * @param {number} at
 * @param {number} [readyAt]
 * @returns {boolean}
 */
export function isInternalCooldownReady(at: number, readyAt = 0): boolean {
  const triggerAt = Number(at);
  const blockedThrough = Number(readyAt);
  // Existing state models use 0 to mean that the ICD has never been armed.
  return blockedThrough === 0 ? triggerAt >= 0 : triggerAt > blockedThrough;
}
