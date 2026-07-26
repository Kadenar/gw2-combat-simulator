/**
 * Internal cooldowns remain active through their recorded boundary timestamp.
 * A proc at exactly readyAt is blocked; only a later timestamp may trigger it.
 */
export function isInternalCooldownReady(at, readyAt = 0) {
  const triggerAt = Number(at);
  const blockedThrough = Number(readyAt);
  // Existing state models use 0 to mean that the ICD has never been armed.
  return blockedThrough === 0
    ? triggerAt >= 0
    : triggerAt > blockedThrough;
}
