import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/types.js';
import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { convertBerserkPower } from '#gw2/professions/warrior/core/traits/behavior.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import { berserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

export const DETONATE = 'warrior.king-of-fires-detonate';

export function active(context: Gw2ModifierContext): boolean {
  return Boolean(
    readProfessionSpecializationState<{ berserkActive?: boolean }>(context.runtime?.profession, 'Berserker')
      ?.berserkActive
  );
}

export function modifyAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const conversionPower = context.config?.stats?.power ?? attributes.power ?? 0;
  const conversionPrecision = context.config?.stats?.precision ?? attributes.precision ?? 0;
  const result = { ...attributes } as Gw2MutableStats & {
    power: number;
    precision: number;
    ferocity: number;
    conditionDamage: number;
  };
  if (active(context)) {
    const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
    const powerBonus = balanceProfileNumber(resourcesProfile, 'attributeBonus');
    result.power += powerBonus;
    result.conditionDamage += balanceProfileNumber(resourcesProfile, 'attributePerStack');
    convertBerserkPower(context, result, powerBonus);
  }

  if (hasTrait(context, TRAIT.BLOOD_REACTION)) {
    const bloodReactionProfile = requireBalanceProfileFromContext(context, TRAIT.BLOOD_REACTION);
    const conversion = active(context)
      ? balanceProfileNumber(bloodReactionProfile, 'coefficientMultiplier')
      : balanceProfileNumber(bloodReactionProfile, 'attributeConversion');
    result.ferocity += conversionPrecision * conversion;
    result.conditionDamage += conversionPower * conversion;
  }

  return result;
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
    runtime.effects.emit({
      kind: 'packet',
      event: buildResolverStrike({
        ...fields,
        name: 'King of Fires — Fire Aura Detonation',
        coefficient: effectNumber(profile, strike, 'coefficient'),
        canTriggerCriticalTraits: true,
        skillWeapon: ''
      })
    });
  if (burning) {
    runtime.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        ...fields,
        name: 'King of Fires — Burning',
        condition: 'Burning',
        stacks: effectNumber(profile, burning, 'stacks'),
        duration: effectNumber(profile, burning, 'duration')
      })
    });
  }
}

type Runtime = Gw2Runtime<WarriorRuntimeState, WarriorSkill>;

/** Entry rewards retain their intrinsic and selected eligibility. */
export function berserkEntryTraits(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.BURST_OF_AGGRESSION);
    runtime.effects.emit({
      kind: 'profile',
      profile: profile,
      effects: profile.effects?.filter((effect) => effect.type === 'boon'),
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.BURST_OF_AGGRESSION,
        actorType: 'effect',
        activationId: cast.id,
        skillId: cast.skill.id,
        skillName: cast.skill.name
      },
      transform: (event) => ({
        ...event,
        name: profile.name,
        duration: event.duration,
        audience: { recipients: 'self' }
      })
    });
  }

  if (hasTrait(runtime, TRAIT.BLOODY_ROAR)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.BLOODY_ROAR);
    runtime.effects.emit({
      kind: 'profile',
      profile: profile,
      effects: profile.effects?.filter((effect) => effect.type === 'boon'),
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.BLOODY_ROAR,
        actorType: 'effect',
        activationId: cast.id,
        skillId: cast.skill.id,
        skillName: cast.skill.name
      },
      transform: (event) => ({
        ...event,
        name: profile.name,
        duration: event.duration,
        audience: { recipients: 'self' }
      })
    });
  }
}

/** Return trait extension before the mode owner publishes its new deadline. */
export function berserkTraitExtension(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): number {
  const skill = cast.skill;
  let extension = 0;
  if (skill.primalBurst && hasTrait(runtime, TRAIT.SMASH_BRAWLER))
    extension += balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, TRAIT.SMASH_BRAWLER),
      skill.id === ID.DECAPITATE ? 'minimumStacks' : 'resourceGain'
    );
  if (skill.categories?.includes('Rage')) {
    if (skill.id !== ID.OUTRAGE && hasTrait(runtime, TRAIT.LAST_BLAZE))
      extension += balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, TRAIT.LAST_BLAZE),
        'durationMultiplier'
      );
  }

  return extension;
}

/** Completion observes the updated mode before granting heat and scheduling aura detonation. */
export function berserkerCompletionTraits(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  if (cast.skill.primalBurst && hasTrait(runtime, TRAIT.HEAT_THE_SOUL)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.HEAT_THE_SOUL);
    runtime.effects.emit({
      kind: 'profile',
      profile: profile,
      effects: profile.effects?.filter((effect) => effect.type === 'boon'),
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.HEAT_THE_SOUL,
        actorType: 'effect',
        activationId: cast.id,
        skillId: cast.skill.id,
        skillName: cast.skill.name
      },
      transform: (event) => ({
        ...event,
        name: profile.name,
        duration:
          event.kind === 'quickness' && cast.skill.id === ID.DECAPITATE
            ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SMASH_BRAWLER), 'resourceGain')
            : event.duration,
        audience: { recipients: 'party' }
      })
    });
  }

  if (isBerserkerSkill(cast.skill) && hasTrait(runtime, TRAIT.KING_OF_FIRES)) {
    berserkerState.from(runtime).completedActivations[cast.id] = runtime.time;
    runtime.schedule(DETONATE, runtime.time, { activationId: cast.id, skillId: cast.skill.id }, undefined, 5);
  }
}
