import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import {
  cloneNecromancerAttributes,
  necromancerRuntimeSpecializationState
} from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

import { armScourgePlagueSending } from '#gw2/professions/necromancer/core/traits/conditions.js';
import { applyScourgeSoulBarbs } from '#gw2/professions/necromancer/core/traits/shroud.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { party } from '#gw2/professions/necromancer/specializations/scourge/mechanics/audiences.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
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
  {
    /* Trait payloads and their timeline annotation share the same emission boundary. */ context.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.DEMONIC_LORE,
        actorType: 'effect',
        skillName: 'Demonic Lore',
        triggeredBy: event.skillName,
        type: 'condition',
        ownerActorType: 'player',
        name: 'Demonic Lore' + ' - ' + String(effect.condition),
        condition: String(effect.condition),
        stacks: effectNumber(profile, effect, 'stacks'),
        duration: effectNumber(profile, effect, 'duration')
      }
    });
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Demonic Lore', at: event.at, sourceSkill: event.skillName }
    });
  }
}

/** Exposes Scourge's condition-triggered trait reaction. */
export const scourgeResolverEventReactions = Object.freeze({
  condition: reactToCondition
});

export function barrierTraits(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
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
    runtime.effects.emit({ kind: 'packet', event: event, durationContext: event });
  }
}

export function shadeTraits(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  const skill = cast.skill;

  if (skill.id === ID.DESERT_SHROUD || skill.id === ID.SANDSTORM_SHROUD) {
    armScourgePlagueSending(runtime);

    applyScourgeSoulBarbs(runtime, cast);
  }

  if (skill.id === ID.NEFARIOUS_FAVOR && hasTrait(runtime, TRAIT.SADISTIC_SEARING)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.SADISTIC_SEARING);
    const condition = requireEffect(profile, 'condition', 'Burning');
    if (condition) {
      // Shared emission owns transport; the mechanic selects attribution and delivery.
      const emissionRuntime: NecromancerRuntime = runtime;
      const emissionCast: RuntimeCast<NecromancerSkill> = cast;
      const emissionEvent: SimulationEventBase = buildResolverCondition({
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
      });

      emissionRuntime.effects.emit({
        kind: 'packet',
        event: {
          ...emissionEvent,
          activationId: emissionCast.id,
          offTarget: emissionCast.command.offTarget,
          at: canonicalTime(
            emissionEvent.at +
              (isHostileTargetEvent(emissionEvent) ? (emissionCast.command.impactDelayMs ?? 0) / 1000 : 0)
          )
        }
      });
    }
  }
}

/** Owns the trait decision at the existing availability integration boundary. */
export const heraldOfSorrowAvailability: NonNullable<
  RuntimeProfession<NecromancerRuntimeState, NecromancerSkill>['availability']
> = (runtime, skill) => {
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
export const sandSavantMaximumAmmo: NonNullable<
  RuntimeProfession<NecromancerRuntimeState, NecromancerSkill>['maximumAmmo']
> = (context, skill, maximum) => {
  return skill.id === ID.MANIFEST_SAND_SHADE && context.hasTrait(TRAIT.SAND_SAVANT)
    ? balanceProfileNumber(context.requireBalanceProfile(TRAIT.SAND_SAVANT), 'maximumStacks')
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
export function desertEmpowermentManifest(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  if (hasTrait(runtime, TRAIT.DESERT_EMPOWERMENT)) barrierTraits(runtime, cast);
}
