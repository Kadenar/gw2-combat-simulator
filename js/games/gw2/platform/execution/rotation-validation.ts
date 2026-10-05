import type { CatalogLookup, SkillId } from '#gw2/platform/skills/types.js';

const MILLISECOND_FIELDS = Object.entries({
  concurrentOffsetMs: 'Concurrent offset',
  interruptAfterMs: 'Interrupt duration',
  initialStateDurationMs: 'Initial-state duration',
  impactDelayMs: 'Impact delay',
  releaseDelayMs: 'Release delay'
});
const CAST_FIELDS = [
  'interruptAfterMs',
  'initialStateDurationMs',
  'releaseAtCharges',
  'doubleEdgeOutcome',
  'impactDelayMs',
  'offTarget'
];

/** Validate decoded command intent before normalization discards zero values or irrelevant payloads. */
export function validateRotationCommand(
  command: unknown,
  catalog: CatalogLookup | null = null,
  { requireKnownSkill = false }: { readonly requireKnownSkill?: boolean } = {}
): string[] {
  if (!command || typeof command !== 'object' || Array.isArray(command))
    return ['rotation contains an invalid canonical command.'];
  const candidate = command as Record<string, unknown>;
  if (
    typeof candidate.type !== 'string' ||
    !['cast', 'wait', 'combat-start', 'cooldown-reset'].includes(candidate.type)
  )
    return ['rotation contains an invalid canonical command.'];

  const errors: string[] = [];
  for (const [field, label] of MILLISECOND_FIELDS) {
    if (candidate[field] == null) continue;
    const value = Number(candidate[field]);
    const signed = field === 'concurrentOffsetMs' && candidate.type === 'combat-start';
    if (!Number.isFinite(value) || (!signed && value < 0))
      errors.push(`${label} must be ${signed ? 'a finite' : 'a non-negative'} number.`);
  }

  if (
    candidate.releaseAtCharges != null &&
    (!Number.isInteger(Number(candidate.releaseAtCharges)) || Number(candidate.releaseAtCharges) < 1)
  )
    errors.push('releaseAtCharges must be a positive whole number.');
  if (
    candidate.doubleEdgeOutcome != null &&
    candidate.doubleEdgeOutcome !== 'success' &&
    candidate.doubleEdgeOutcome !== 'backfire'
  )
    errors.push('Double Edge outcome must be either success or backfire.');
  if (candidate.offTarget != null && typeof candidate.offTarget !== 'boolean')
    errors.push('Off-target cast must be a boolean.');

  if (candidate.type !== 'cast') {
    for (const field of CAST_FIELDS)
      if (candidate[field] != null) errors.push(`only cast commands may contain ${field}.`);
  }

  // Even a zero hold must belong to Dragon Slash before normalization can omit it.
  if (
    candidate.releaseDelayMs != null &&
    (candidate.type !== 'cast' || !catalog?.skillsById?.get(candidate.skillId as SkillId)?.dragonSlash)
  )
    errors.push('only Dragon Slash casts may contain releaseDelayMs.');

  if (candidate.offTarget === true && Number(candidate.impactDelayMs) > 0)
    errors.push('off-target casts cannot contain impactDelayMs.');

  if (candidate.type === 'wait') {
    if (
      candidate.durationMs == null ||
      !Number.isFinite(Number(candidate.durationMs)) ||
      Number(candidate.durationMs) < 0
    )
      errors.push('wait commands require a non-negative durationMs.');
    if (candidate.concurrentOffsetMs != null) errors.push('wait commands cannot contain concurrentOffsetMs.');
  }

  if (candidate.type === 'cast') {
    const id = candidate.skillId;
    if (id == null || id === '') errors.push('Cast command requires skillId.');
    else if (typeof id !== 'number' && typeof id !== 'string')
      errors.push('Cast command skillId must be a string or number.');
    // Saved builds require catalog membership; live execution resolves transformed skills at each command boundary.
    else if (requireKnownSkill && !catalog?.skillsById?.has(id)) errors.push(`rotation contains unknown skill ${id}.`);
  }

  return errors;
}
