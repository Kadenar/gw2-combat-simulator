export function emitGuardianEvent(context, skill, type, event = {}) {
  context.emit({
    type,
    at: context.effectiveEnd,
    source: "guardian",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    ...event,
  });
}

const GUARDIAN_STRIKE_DEFAULTS = Object.freeze({
  type: "damage",
  source: "guardian",
  actorType: "player",
  hits: 1,
  hitIndex: 1,
  totalHits: 1,
  skillWeapon: "",
  canCrit: true,
});

/**
 * Builds a guardian strike (damage) event with the canonical field layout so
 * scheduler-side (context.emit) and resolver-side (enqueueOrdered) callers
 * share one definition instead of retyping ~15 fields per site. Callers pass
 * the values that vary — at, sourceId, skillId, skillName, name, coefficient,
 * and per-pulse hitIndex/totalHits — plus any extras (isSymbol, triggeredBy,
 * stackCount, priority) which override the defaults.
 */
export function buildGuardianStrike(fields) {
  return { ...GUARDIAN_STRIKE_DEFAULTS, ...fields };
}
