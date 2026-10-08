import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefCondition, buildThiefStrikes } from '#gw2/professions/thief/core/events.js';
import { potentPoisonStacks } from '#gw2/professions/thief/core/traits/deadly-arts/poison.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

export function applyEvenTheOdds(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.EVEN_THE_ODDS)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.EVEN_THE_ODDS);
  const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
  if (!vulnerability) return;
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefCondition(cast.skill, {
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.EVEN_THE_ODDS,
      activationId: cast.id,
      name: 'Even the Odds — Vulnerability',
      condition: String(vulnerability.condition),
      duration: effectNumber(profile, vulnerability, 'duration'),
      stacks: effectNumber(profile, vulnerability, 'stacks')
    })
  });
}

/** A selected Improvisation grants the second use before the stored choice is locked. */
export function improvisationStolenUses(context: unknown): number {
  return hasTrait(context, TRAIT.IMPROVISATION)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.IMPROVISATION), 'maximumStacks')
    : 1;
}

/** Improvisation shortens every selected, still-recharging utility once per internal cooldown. */
export function reduceUtilityRecharges(runtime: ThiefRuntime): void {
  if (!hasTrait(runtime, TRAIT.IMPROVISATION)) return;
  // An eligible pilfer claims the interval even when no selected utility is recharging.
  if (!runtime.procs.claim(TRAIT.IMPROVISATION, 'thief.antiquary.improvisation', runtime.time)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.IMPROVISATION);
  const multiplier = balanceProfileNumber(profile, 'rechargeMultiplier');
  for (const id of selectedSkillIdSet(runtime.config.selectedSkillIds)) {
    const skill = runtime.helpers.skillsById.get(id);
    if (skill?.type === 'Utility')
      runtime.cooldownController.reduceSkillRecharge(skill, gw2BaseRecharge(skill) * (1 - multiplier), runtime.time);
  }
}

/** Apply the selected shadow-force gain at the existing Siphon resource boundary. */
export function improvisationShadowForceMultiplier(runtime: MechanicQueriesOf<ThiefRuntime>): number {
  return hasTrait(runtime, TRAIT.IMPROVISATION)
    ? 1 + balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.IMPROVISATION), 'lifeForceGain')
    : 1;
}

/** Only Swipe pilfers receive Improvisation's extra use. */
export function improvisationArtifactUses(runtime: ThiefRuntime, source: string): number {
  return source === 'swipe' && hasTrait(runtime, TRAIT.IMPROVISATION)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.IMPROVISATION), 'resourceGain')
    : 0;
}

/** Mug is an uncritical strike owned by the steal skill. */
export function applyMug(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.MUG)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.MUG);
  const strike = requireEffect(profile, 'strike', 'Mug');
  if (!strike) return;
  buildThiefStrikes(null, {
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.MUG,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id,
    name: 'Mug',
    coefficient: effectNumber(profile, strike, 'coefficient'),
    hits: effectNumber(profile, strike, 'hits'),
    canCrit: false
  }).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
}

/** Serpent's Touch Poison is attributed to its trait while retaining the triggering steal. */
export function applySerpentsTouch(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.SERPENTS_TOUCH)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.SERPENTS_TOUCH);
  const poison = requireEffect(profile, 'condition', 'Poisoned');
  if (!poison) return;
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefCondition(null, {
      at: runtime.time,
      source: 'Trait',
      skillId: TRAIT.SERPENTS_TOUCH,
      skillName: "Serpent's Touch",
      triggeredBy: cast.skill.name,
      activationId: cast.id,
      name: "Serpent's Touch — Poison",
      condition: String(poison.condition),
      duration: effectNumber(profile, poison, 'duration'),
      stacks: potentPoisonStacks(runtime, profile, poison)
    })
  });
}
