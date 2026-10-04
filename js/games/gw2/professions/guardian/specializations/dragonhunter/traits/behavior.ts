import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { buildResolverBuff, buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type {
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianRuntimeState,
  GuardianSkill
} from '#gw2/professions/guardian/types.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

export function reactToDragonhunterControl(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  if (hasTrait(context, TRAIT.DULLED_SENSES)) {
    const dulledSensesProfile = requireBalanceProfileFromContext(context, TRAIT.DULLED_SENSES);
    const crippled = requireEffect(dulledSensesProfile, 'condition', 'Crippled');
    // Control-triggered conditions resolve immediately so their reactions
    // share the originating control timestamp.
    if (crippled) {
      context.effects.emit({
        kind: 'packet',
        settlement: 'reaction',
        event: buildResolverCondition({
          at: event.at,
          source: 'guardian',
          sourceId: TRAIT.DULLED_SENSES,
          activationId: event.activationId,
          causalOrder: event.causalOrder ?? event.eventOrder,
          actorType: 'effect',
          skillId: TRAIT.DULLED_SENSES,
          skillName: 'Dulled Senses',
          name: 'Dulled Senses — Crippled',
          condition: String(crippled.condition),
          stacks: effectNumber(dulledSensesProfile, crippled, 'stacks'),
          duration: effectNumber(dulledSensesProfile, crippled, 'duration')
        })
      });
    }
  }

  if (!hasTrait(context, TRAIT.HEAVY_LIGHT)) return;

  // 1-second internal cooldown on Heavy Light stability; not exposed by the trait's game tooltip.

  const heavyLightProfile = requireBalanceProfileFromContext(context, TRAIT.HEAVY_LIGHT);
  const stability = requireEffect(heavyLightProfile, 'boon', 'stability');
  // Removing Stability leaves Heavy Light's interval unclaimed.
  if (!stability || !context.procs.claim(TRAIT.HEAVY_LIGHT, 'guardian.dragonhunter.heavyLight', event.at)) return;
  context.effects.emit({
    kind: 'packet',
    durationContext: event,
    event: buildResolverBuff({
      at: event.at,
      priority: 5,
      source: 'guardian',
      sourceId: TRAIT.HEAVY_LIGHT,
      activationId: event.activationId,
      causalOrder: event.causalOrder ?? event.eventOrder,
      actorType: 'player',
      skillId: TRAIT.HEAVY_LIGHT,
      skillName: 'Heavy Light',
      kind: 'stability',
      stacks: effectNumber(heavyLightProfile, stability, 'stacks'),
      duration: effectNumber(heavyLightProfile, stability, 'duration')
    })
  });
  context.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Heavy Light',
      at: event.at,
      sourceSkill: event.skillName,
      detail: 'Stability',
      icon: guardianTraitIcon(TRAIT.HEAVY_LIGHT)
    }
  });
}

/** The elite cast grants endurance after its accepted virtue activation rewards. */
export function completeHuntersDetermination(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): void {
  if (cast.skill.slot === 'Elite' && hasTrait(runtime, TRAIT.HUNTERS_DETERMINATION)) {
    const amount = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, TRAIT.HUNTERS_DETERMINATION),
      'resourceGain'
    );
    runtime.endurance.grant(amount);
    {
      runtime.effects.emit({
        kind: 'announcement',
        announcement: {
          type: 'trait',
          name: "Hunter's Determination",
          at: runtime.time,
          sourceSkill: cast.skill.name,
          detail: `${amount} endurance`,
          icon: guardianTraitIcon(TRAIT.HUNTERS_DETERMINATION)
        }
      });
    }
  }
}

/** Wings retains live base effects and the weapon selected at acceptance before materialization. */
export const soaringDevastationEffects: NonNullable<Skill['effectVariants']>[number] = {
  when: (runtime) => hasTrait(runtime, TRAIT.SOARING_DEVASTATION),
  profileId: TRAIT.SOARING_DEVASTATION,
  transform: (runtime, cast, effects) => [
    ...(cast.skill.effects ?? []),
    ...effects
      .filter((effect) => effect.type === 'strike' || effect.type === 'condition')
      .map((effect) => ({
        ...effect,
        name:
          effect.type === 'strike'
            ? 'Wings of Resolve \u2014 Soaring Devastation'
            : 'Soaring Devastation \u2014 Immobilized',
        weapon: gw2ActivePrimaryWeapon(runtime.config, runtime.activeWeaponSet),
        timingAnchor: 'castEnd' as const
      }))
  ]
};

/** Justice owns the tether lifecycle; this trait selects only the active tether's duration. */
export function bigGameHunterTetherDuration(runtime: Runtime, baseDuration: number): number {
  return hasTrait(runtime, TRAIT.BIG_GAME_HUNTER)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BIG_GAME_HUNTER), 'pulseInterval')
    : baseDuration;
}
