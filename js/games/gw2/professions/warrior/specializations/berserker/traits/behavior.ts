// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';

import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { berserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

export const DETONATE = 'warrior.king-of-fires-detonate';

export function active(context: Gw2ModifierContext): boolean {
  return Boolean(
    readProfessionSpecializationState<{ berserkActive?: boolean }>(context.runtime?.profession, 'Berserker')
      ?.berserkActive
  );
}

export function isBerserkerSkill(skill: WarriorSkill): boolean {
  return skill.primalBurst || skill.categories?.includes('Rage') || skill.specialization === 'Berserker';
}

export function armAura(runtime: Runtime, until: number): void {
  const state = berserkerState.from(runtime);
  state.fireAuraUntil = Math.max(state.fireAuraUntil, until);
}

export function detonate(runtime: Runtime, payload: { activationId: string; skillId: number | string }): void {
  const state = berserkerState.from(runtime);
  if (state.fireAuraUntil <= runtime.time) return;
  const skill = runtime.helpers.skillsById.get(payload.skillId);
  if (!skill) return;
  state.fireAuraUntil = 0;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.KING_OF_FIRES);
  const strike = requireEffect(profile, 'strike', 'Strike');
  const burning = requireEffect(profile, 'condition', 'Burning');
  const fields = {
    at: runtime.time,
    // The detonation and its condition packets share one trait activation, separate from the triggering cast.
    activationId: `${payload.activationId}:king-of-fires:${runtime.time}`,
    source: 'Trait',
    sourceId: TRAIT.KING_OF_FIRES,
    actorType: 'effect' as const,
    ownerActorType: 'player' as const,
    skillId: skill.id,
    skillName: skill.name
  };
  runtime.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: { ...fields },
    announcement: {
      name: 'King of Fires',
      sourceSkill: skill.name,
      detail: 'Fire Aura detonated',
      type: 'trait',
      at: fields.at
    }
  });
  if (strike)
    emitTraitProfile(runtime, TRAIT.KING_OF_FIRES, TRAIT.KING_OF_FIRES, undefined, {
      at: runtime.time,
      fullEnd: runtime.time,
      effect: { type: 'strike', name: 'Strike' },
      attribution: {
        activationId: `${payload.activationId}:king-of-fires:${runtime.time}`,
        source: 'Trait',
        sourceId: TRAIT.KING_OF_FIRES,
        actorType: 'effect' as const,
        ownerActorType: 'player' as const,
        skillId: skill.id,
        skillName: skill.name,
        name: 'King of Fires — Fire Aura Detonation',
        skillWeapon: ''
      },
      transform: (packet) => ({ ...packet, canTriggerCriticalTraits: true })
    });
  if (burning) {
    emitTraitProfile(runtime, TRAIT.KING_OF_FIRES, TRAIT.KING_OF_FIRES, undefined, {
      at: runtime.time,
      fullEnd: runtime.time,
      effect: { type: 'condition', name: 'Burning' },
      attribution: {
        activationId: `${payload.activationId}:king-of-fires:${runtime.time}`,
        source: 'Trait',
        sourceId: TRAIT.KING_OF_FIRES,
        actorType: 'effect' as const,
        ownerActorType: 'player' as const,
        skillId: skill.id,
        skillName: skill.name,
        name: 'King of Fires — Burning'
      }
    });
  }
}

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

/** Query Smash Brawler's extension before the mode owner publishes its deadline. */
export function smashBrawlerBerserkExtension(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): number {
  return cast.skill.primalBurst && hasTrait(runtime, TRAIT.SMASH_BRAWLER)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, TRAIT.SMASH_BRAWLER),
        cast.skill.id === ID.DECAPITATE ? 'minimumStacks' : 'resourceGain'
      )
    : 0;
}

/** Query Last Blaze's Rage extension without mutating the active mode. */
export function lastBlazeBerserkExtension(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): number {
  return cast.skill.categories?.includes('Rage') && cast.skill.id !== ID.OUTRAGE && hasTrait(runtime, TRAIT.LAST_BLAZE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.LAST_BLAZE), 'durationMultiplier')
    : 0;
}
