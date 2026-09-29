import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { buildResolverBuff, buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { guardianTraitIcon, recordGuardianTraitProc } from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type {
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianRuntimeState
} from '#gw2/professions/guardian/types.js';

type Runtime = Gw2Runtime<GuardianRuntimeState>;

export function reactToDragonhunterControl(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  if (hasTrait(context, TRAIT.DULLED_SENSES)) {
    const dulledSensesProfile = requireBalanceProfileFromContext(context, TRAIT.DULLED_SENSES);
    const crippled = requireEffect(dulledSensesProfile, 'condition', 'Crippled');
    // Control-triggered conditions resolve immediately so their reactions
    // share the originating control timestamp.
    if (crippled) {
      context.applyCondition(
        buildResolverCondition({
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
      );
    }
  }

  if (!hasTrait(context, TRAIT.HEAVY_LIGHT)) return;

  // 1-second internal cooldown on Heavy Light stability; not exposed by the trait's game tooltip.

  const heavyLightProfile = requireBalanceProfileFromContext(context, TRAIT.HEAVY_LIGHT);
  const stability = requireEffect(heavyLightProfile, 'boon', 'stability');
  // Removing Stability leaves Heavy Light's interval unclaimed.
  if (!stability || !context.procs.claim(TRAIT.HEAVY_LIGHT, 'guardian.dragonhunter.heavyLight', event.at)) return;
  queueResolverBoon(
    context,
    event,
    buildResolverBuff({
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
  );
  context.recordProc(
    'trait',
    'Heavy Light',
    event.at,
    event.skillName,
    'Stability',
    guardianTraitIcon(TRAIT.HEAVY_LIGHT)
  );
}

/** The elite cast grants endurance after its accepted virtue activation rewards. */
export function completeHuntersDetermination(runtime: Runtime, cast: RuntimeCast): void {
  if (cast.skill.slot === 'Elite' && hasTrait(runtime, TRAIT.HUNTERS_DETERMINATION)) {
    const amount = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, TRAIT.HUNTERS_DETERMINATION),
      'resourceGain'
    );
    runtime.endurance.grant(amount);
    recordGuardianTraitProc(
      runtime,
      TRAIT.HUNTERS_DETERMINATION,
      "Hunter's Determination",
      runtime.time,
      cast.skill.name,
      `${amount} endurance`
    );
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
