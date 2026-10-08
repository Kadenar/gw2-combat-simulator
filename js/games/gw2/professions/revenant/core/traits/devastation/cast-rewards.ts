import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** A committed weapon swap grants Brutality's Quickness once per its internal cooldown. */
export function completeRevenantBrutality(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  if (!hasTrait(runtime, TRAIT.BRUTALITY)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.BRUTALITY);
  const boon = requireEffect(profile, 'boon', 'quickness');
  // The cooldown gates only quickness, so a removed boon leaves it ready.
  if (!boon) return;
  if (!runtime.procs.claimCooldown('brutality', runtime.time, balanceProfileNumber(profile, 'cooldown'))) return;
  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: [boon],
    attribution: {
      source: 'Trait',
      actorType: 'player',
      sourceId: TRAIT.BRUTALITY,
      skillId: TRAIT.BRUTALITY,
      skillName: 'Brutality',
      activationId: cast.id
    },
    transform: (event) => ({
      ...event,
      sourceId: TRAIT.BRUTALITY,
      skillId: TRAIT.BRUTALITY,
      skillName: 'Brutality',
      name: 'Brutality — quickness',
      activationId: cast.id
    })
  });
}

/** Runs the trait at its original ordered mechanic boundary. */
export function completeNotoriety(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const skill = cast.skill;
  if (runtime.combatStartedAt() && isLegendaryStanceSkill(skill) && hasTrait(runtime, TRAIT.NOTORIETY)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.NOTORIETY);
    const boon = requireEffect(profile, 'boon', 'might');
    if (boon)
      runtime.effects.emit({
        kind: 'profile',
        profile: profile,
        effects: [boon],
        attribution: {
          source: 'Trait',
          actorType: 'player',
          sourceId: TRAIT.NOTORIETY,
          skillId: skill.id,
          skillName: skill.name,
          activationId: cast.id
        },
        transform: (event) => ({
          ...event,
          sourceId: TRAIT.NOTORIETY,
          skillId: skill.id,
          skillName: skill.name,
          name: 'Notoriety — might',
          activationId: cast.id
        })
      });
  }
}

function isLegendaryStanceSkill(skill: RevenantSkill): boolean {
  if (['Heal', 'Utility', 'Elite'].includes(String(skill.slot || '')) && skill.legendId) return true;
  return skill.type === 'Profession';
}
