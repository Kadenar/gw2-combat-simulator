import { ritualistPartyBoonPolicy } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/party-boons.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import {
  registerCreatureSummonReaction,
  registerNecromancerCreatureStrikeMultiplier
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Applies Boon of Creation at the original attribute-conversion position. */
export function modifyBoonOfCreationAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (!professionStaticRulesApplied(context.config) && hasTrait(context, TRAIT.BOON_OF_CREATION)) {
    const boonOfCreationProfile = requireBalanceProfileFromContext(context, TRAIT.BOON_OF_CREATION);
    result.concentration += balanceProfileNumber(boonOfCreationProfile, 'attributeBonus');
  }
}

/** Summon boons follow the shared creature reactions and precede autonomous scheduling. */
export function applyEmpoweringSpirits(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  key: string
): void {
  if (hasTrait(runtime, TRAIT.EMPOWERING_SPIRITS)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.EMPOWERING_SPIRITS);
    for (const kind of ['quickness', key === 'anguish' ? 'might' : key === 'wanderlust' ? 'fury' : 'resolution']) {
      const effect = requireEffect(profile, 'boon', kind);
      if (effect) {
        runtime.effects.emit({
          kind: 'profile',
          profile: profile,
          effects: [effect],
          ...ritualistPartyBoonPolicy(runtime, cast)
        });
      }
    }
  }
}

/** Creature callbacks preserve Boon of Creation before Explosive Growth and share the same actor multiplier. */
export function initializeRitualistSummonTraits(runtime: NecromancerRuntime): void {
  registerCreatureSummonReaction(runtime, 'ritualist.creature-summon-traits', (skill, at, count, activationId) => {
    if (hasTrait(runtime, TRAIT.BOON_OF_CREATION))
      grantNecromancerLifeForce(
        runtime,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BOON_OF_CREATION), 'lifeForceGain') * count
      );
    if (!hasTrait(runtime, TRAIT.EXPLOSIVE_GROWTH)) return;
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.EXPLOSIVE_GROWTH);
    const strike = requireEffect(profile, 'strike', 'Strike');
    if (strike)
      runtime.effects.emit({
        kind: 'packet',
        event: buildResolverStrike({
          type: 'damage',
          at,
          source: 'Trait',
          sourceId: TRAIT.EXPLOSIVE_GROWTH,
          actorType: 'effect',
          skillId: TRAIT.EXPLOSIVE_GROWTH,
          skillName: 'Explosive Growth',
          parentSkillName: skill.name,
          // The summon triggers an independent trait strike; it must not reuse the summon cast's weapon roll.
          activationId: `${activationId}:explosive-growth:${at}`,
          triggeredBy: skill.name,
          coefficient: effectNumber(profile, strike, 'coefficient') * count,
          skillWeapon: 'Unequipped'
        })
      });
  });
  registerNecromancerCreatureStrikeMultiplier(runtime, 'ritualist.spirits-strength', () =>
    hasTrait(runtime, TRAIT.SPIRITS_STRENGTH)
      ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SPIRITS_STRENGTH), 'damageMultiplier')
      : 1
  );
}

/** Lingering Spirits controls post-shroud lifetime and its continuing resource drain. */
export function lingeringSpiritsActive(runtime: NecromancerRuntime): boolean {
  return hasTrait(runtime, TRAIT.LINGERING_SPIRITS);
}

/** Entry arms a single summon refund; the granted refund survives until a summon consumes it. */
export function armSoulTwisting(runtime: NecromancerRuntime): void {
  ritualistState.from(runtime).soulTwistingAvailable = hasTrait(runtime, TRAIT.SOUL_TWISTING);
}

/** Only a committed summon spends the refund. */
export function consumeSoulTwisting(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  const state = ritualistState.from(runtime);
  if (state.soulTwistingAvailable) {
    state.soulTwistingAvailable = false;
    runtime.cooldownController.clear(cast.skill.id);
  }
}

/** Wielder's Boon grants allied recipients the player's full charge count. */
export function wieldersBoonCharges(runtime: NecromancerRuntime, effect: SkillEffect): number {
  return hasTrait(runtime, TRAIT.WIELDERS_BOON) ? Number(effect.stacks ?? 0) : Number(effect.allyStacks ?? 0);
}
