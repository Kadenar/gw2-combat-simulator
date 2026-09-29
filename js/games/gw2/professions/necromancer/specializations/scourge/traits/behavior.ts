import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import {
  cloneNecromancerAttributes,
  necromancerRuntimeSpecializationState
} from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { applyTraitCondition } from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { armScourgePlagueSending } from '#gw2/professions/necromancer/core/traits/conditions.js';
import { applyScourgeSoulBarbs } from '#gw2/professions/necromancer/core/traits/shroud.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { emitPacket, party } from '#gw2/professions/necromancer/specializations/scourge/mechanics/emission.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerRuntimeState
} from '#gw2/professions/necromancer/types.js';

/** Applies Fell Beacon at the original attribute-conversion position. */
export function modifyFellBeaconAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (!professionStaticRulesApplied(context.config) && hasTrait(context, TRAIT.FELL_BEACON)) {
    const fellBeaconProfile = requireBalanceProfileFromContext(context, TRAIT.FELL_BEACON);
    // Fell Beacon converts 7% of condition damage into expertise; must use raw
    // gear stats (config.stats) not the merged attribute record because might
    // stacks and trait bonuses like Lingering Curse are already folded in there
    result.expertise +=
      (context.config?.stats?.conditionDamage || 0) * balanceProfileNumber(fellBeaconProfile, 'attributeConversion');
  }
}

/** Applies Sand Sage at the original attribute-conversion position. */
export function modifySandSageAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (
    hasTrait(context, TRAIT.SAND_SAGE) &&
    // Bonus only applies when at least one shade is alive — check expiry timestamps against current sim time
    (necromancerRuntimeSpecializationState(context, 'Scourge').shades || []).some(
      (expiresAt: number) => expiresAt > context.time
    )
  ) {
    const sandSageProfile = requireBalanceProfileFromContext(context, TRAIT.SAND_SAGE);
    const bonus = balanceProfileNumber(sandSageProfile, 'attributeBonus');
    // Dynamic attribute queries may begin from sparse input stats, so normalize
    // absent duration attributes before applying Sand Sage's active-shade bonus.
    result.concentration = (result.concentration || 0) + bonus;
    result.expertise = (result.expertise || 0) + bonus;
  }
}

// Convert eligible Torment applications into Demonic Lore burns while enforcing its resolver-owned cooldown.
function reactToCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // Only Torment triggers Demonic Lore — all other conditions are ignored here
  if (event.condition !== 'Torment' || !hasTrait(context, TRAIT.DEMONIC_LORE)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.DEMONIC_LORE);
  const effect = requireEffect(profile, 'condition', 'Burning');
  // The cooldown gates only Burning, so a removed packet leaves it ready.
  if (!effect) return;
  // Advance the ICD before applying the condition so re-entrant Torment events
  // within the same tick cannot double-proc
  if (
    !context.procs.claimCooldown('necromancer.scourge.demonicLore', event.at, balanceProfileNumber(profile, 'cooldown'))
  )
    return;
  applyTraitCondition(context, event, {
    name: 'Demonic Lore',
    traitId: TRAIT.DEMONIC_LORE,
    condition: String(effect.condition),
    stacks: effectNumber(profile, effect, 'stacks'),
    duration: effectNumber(profile, effect, 'duration')
  });
}

/** Exposes Scourge's condition-triggered trait reaction. */
export const scourgeResolverEventReactions = Object.freeze({
  condition: reactToCondition
});

export function barrierTraits(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  for (const [trait, kind] of [
    [TRAIT.ABRASIVE_GRIT, 'might'],
    [TRAIT.DESERT_EMPOWERMENT, 'alacrity']
  ] as const) {
    if (!hasTrait(runtime, trait)) continue;
    const profile = requireBalanceProfileFromContext(runtime, trait);
    const effect = requireEffect(profile, 'boon', kind);
    if (!effect) continue;
    const event = {
      type: 'buff' as const,
      at: runtime.time,
      source: 'necromancer',
      sourceId: cast.skill.id,
      actorType: 'player' as const,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      kind,
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks'),
      audience: party(runtime)
    };
    queueResolverBoon(runtime, event, event);
  }
}

export function shadeTraits(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;

  if (skill.id === ID.DESERT_SHROUD || skill.id === ID.SANDSTORM_SHROUD) {
    armScourgePlagueSending(runtime);

    applyScourgeSoulBarbs(runtime, cast);
  }

  if (skill.id === ID.NEFARIOUS_FAVOR && hasTrait(runtime, TRAIT.SADISTIC_SEARING)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.SADISTIC_SEARING);
    const condition = requireEffect(profile, 'condition', 'Burning');
    if (condition)
      emitPacket(
        runtime,
        cast,
        buildResolverCondition({
          at: runtime.time,
          source: 'Trait',
          sourceId: TRAIT.SADISTIC_SEARING,
          actorType: 'effect',
          ownerActorType: 'player',
          skillId: skill.id,
          skillName: skill.name,
          condition: String(condition.condition),
          stacks: effectNumber(profile, condition, 'stacks'),
          duration: effectNumber(profile, condition, 'duration')
        })
      );
  }
}

/** Owns the trait decision at the existing availability integration boundary. */
export const heraldOfSorrowAvailability: NonNullable<RuntimeProfession<NecromancerRuntimeState>['availability']> = (
  runtime,
  skill
) => {
  const herald = hasTrait(runtime, TRAIT.HERALD_OF_SORROW);
  if (skill.id === ID.SANDSTORM_SHROUD && !herald)
    return denySkillCast(skill, 'necromancer.trait-replacement', 'requires Herald of Sorrow.');
  if (skill.id === ID.DESERT_SHROUD && herald)
    return denySkillCast(
      skill,
      'necromancer.trait-replacement',
      'replaced by Sandstorm Shroud while Herald of Sorrow is selected.'
    );
  return { ready: true };
};

/** Owns the trait decision at the existing maximumAmmo integration boundary. */
export const sandSavantMaximumAmmo: NonNullable<RuntimeProfession<NecromancerRuntimeState>['maximumAmmo']> = (
  runtime,
  skill,
  maximum
) => {
  return skill.id === ID.MANIFEST_SAND_SHADE && hasTrait(runtime, TRAIT.SAND_SAVANT)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SAND_SAVANT), 'maximumStacks')
    : maximum;
};

/** Preserves Demonic Lore before the Nourishing Ashes claim on the accepted condition. */
export function reactToScourgeTraits(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  scourgeResolverEventReactions.condition(runtime, event);
  if (event.condition !== 'Burning' || !hasTrait(runtime, TRAIT.NOURISHING_ASHES)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.NOURISHING_ASHES);
  // A qualifying Burning application claims before its life-force reward.
  if (
    !runtime.procs.claimCooldown(
      'necromancer.scourge.nourishingAshes',
      runtime.time,
      balanceProfileNumber(profile, 'cooldown')
    )
  )
    return;
  grantNecromancerLifeForce(runtime, balanceProfileNumber(profile, 'lifeForceGain'));
}

/** Sand Savant selects the same profile for lifetime, capacity and recharge. */
export function sandSavantShadeProfile(runtime: NecromancerRuntime) {
  return requireBalanceProfileFromContext(
    runtime,
    hasTrait(runtime, TRAIT.SAND_SAVANT) ? TRAIT.SAND_SAVANT : PROFILE.shade
  );
}

/** Manifest's barrier reward runs after the shade is present. */
export function desertEmpowermentManifest(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  if (hasTrait(runtime, TRAIT.DESERT_EMPOWERMENT)) barrierTraits(runtime, cast);
}
