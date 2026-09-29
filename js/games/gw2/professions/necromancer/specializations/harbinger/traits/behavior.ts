import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/skills/timing.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import {
  applyTraitCondition,
  applyTraitVulnerability
} from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { necromancerLifeForceCostMultiplier } from '#gw2/professions/necromancer/core/state.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  emitHarbingerEffects,
  party
} from '#gw2/professions/necromancer/specializations/harbinger/mechanics/emission.js';
import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import { harbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Applies Alchemic Vigor at the original attribute-conversion position. */
export function modifyAlchemicVigorAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (context.config?.specialization === 'Harbinger' || hasTrait(context, TRAIT.ALCHEMIC_VIGOR)) {
    const alchemicVigorProfile = requireBalanceProfileFromContext(context, TRAIT.ALCHEMIC_VIGOR);
    result.vitality += balanceProfileNumber(alchemicVigorProfile, 'attributeBonus');
  }
}

/** Applies Implacable Foe at the original attribute-conversion position. */
export function modifyImplacableFoeAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.IMPLACABLE_FOE)) {
    const implacableFoeProfile = requireBalanceProfileFromContext(context, TRAIT.IMPLACABLE_FOE);
    result.ferocity += result.vitality * balanceProfileNumber(implacableFoeProfile, 'attributeConversion');
  }
}

/** Applies Twisted Medicine at the original attribute-conversion position. */
export function modifyTwistedMedicineAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.TWISTED_MEDICINE)) {
    const twistedMedicineProfile = requireBalanceProfileFromContext(context, TRAIT.TWISTED_MEDICINE);
    result.concentration += result.vitality * balanceProfileNumber(twistedMedicineProfile, 'attributeConversion');
  }
}

/** Applies Dark Gunslinger at the original attribute-conversion position. */
export function modifyDarkGunslingerAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.DARK_GUNSLINGER)) {
    const darkGunslingerProfile = requireBalanceProfileFromContext(context, TRAIT.DARK_GUNSLINGER);
    // Alchemic Vigor and other flat Vitality bonuses precede conversion.
    result.expertise += Math.round(
      result.vitality * balanceProfileNumber(darkGunslingerProfile, 'attributeConversion')
    );
  }
}

/** Applies Harbinger traits triggered by eligible resolved player or summon strikes. */
function reactToDamage(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // Trait procs must not trigger from synthetic "effect" damage (e.g. Cascading Corruption Meltdown hits).
  if (event.actorType === 'effect' || !(Number(event.coefficient) > 0)) return;
  const skill = event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
  // Doom Approaches Vulnerability applies only on the first hit of Tainted Bolts, not each chain projectile.
  const firstHit = Number(event.hitIndex || 1) === 1;
  if (hasTrait(context, TRAIT.DOOM_APPROACHES) && firstHit && skill?.id === ID.TAINTED_BOLTS) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.DOOM_APPROACHES);
    const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
    if (vulnerability)
      applyTraitVulnerability(context, event, {
        name: 'Doom Approaches',
        traitId: TRAIT.DOOM_APPROACHES,
        stacks: effectNumber(profile, vulnerability, 'stacks'),
        duration: effectNumber(profile, vulnerability, 'duration')
      });
  }

  // Septic Corruption procs on shroud slot 2 specifically (the pistol #2 skill), not all pistol hits.
  if (hasTrait(context, TRAIT.SEPTIC_CORRUPTION) && skill?.shroudSlot === 2) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.SEPTIC_CORRUPTION);
    const condition = requireEffect(profile, 'condition', 'Poisoned');
    if (condition)
      applyTraitCondition(context, event, {
        name: 'Septic Corruption',
        traitId: TRAIT.SEPTIC_CORRUPTION,
        condition: String(condition.condition),
        stacks: effectNumber(profile, condition, 'stacks'),
        duration: effectNumber(profile, condition, 'duration')
      });
  }
}

export const harbingerResolverEventReactions = Object.freeze({
  damage: reactToDamage
});

/** Entry and completed Dark Barrage independently deliver the surviving trait boons. */
export function applyDeathlyHaste(runtime: NecromancerRuntime, skill: Skill): void {
  if (!hasTrait(runtime, TRAIT.DEATHLY_HASTE)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.DEATHLY_HASTE);
  emitHarbingerEffects(
    runtime,
    skill,
    (profile.effects ?? []).map((effect) => ({
      ...effect,
      audience: party(runtime),
      source: skill.id === ID.DARK_BARRAGE ? 'Trait' : 'necromancer',
      sourceId: skill.id === ID.DARK_BARRAGE ? TRAIT.DEATHLY_HASTE : skill.id
    }))
  );
}

/** Consumed stacks claim one Meltdown threshold before the mechanic publishes the remaining Blight. */
export function applyCascadingCorruption(runtime: NecromancerRuntime, cast: RuntimeCast, consumed: number): void {
  const state = harbingerState.from(runtime);
  if (
    consumed &&
    hasTrait(runtime, TRAIT.CASCADING_CORRUPTION) &&
    !runtime.combatStartPending &&
    !(runtime.combatStartTime != null && runtime.time < runtime.combatStartTime)
  ) {
    const corruption = requireBalanceProfileFromContext(runtime, TRAIT.CASCADING_CORRUPTION);
    const meltdown = requireEffect(corruption, 'buff', 'meltdown');
    const strike = requireEffect(corruption, 'strike', 'Strike');
    const torment = requireEffect(corruption, 'condition', 'Torment');
    if (meltdown || strike || torment) {
      state.cascadingCorruptionStacks += consumed;
      const threshold = balanceProfileNumber(corruption, 'minimumStacks');
      if (state.cascadingCorruptionStacks >= threshold) {
        state.cascadingCorruptionStacks -= threshold;
        if (meltdown)
          state.meltdownUntil = canonicalTime(runtime.time + effectNumber(corruption, meltdown, 'duration'));
        runtime.emit({
          type: 'proc',
          procType: 'trait',
          at: runtime.time,
          name: 'Meltdown',
          icon: 'https://wiki.guildwars2.com/wiki/Special:FilePath/Meltdown.png',
          sourceSkill: cast.skill.name,
          source: 'Trait',
          sourceId: TRAIT.CASCADING_CORRUPTION,
          actorType: 'effect',
          activationId: cast.id
        });
        emitHarbingerEffects(
          runtime,
          { id: ID.CASCADING_CORRUPTION, name: 'Cascading Corruption', type: 'Trait' },
          [meltdown, strike, torment]
            .filter((effect) => effect != null)
            .map((effect) => ({
              ...effect,
              sourceId: TRAIT.CASCADING_CORRUPTION,
              atMs: quantizeGw2ActionTimingMs(effect.atMs ?? 0)
            })),
          cast
        );
      }
    }
  }
}

/** Elixir boons are chosen at launch, after the shared Blight transaction. */
export function applyBolsteringBrew(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  if (hasTrait(runtime, TRAIT.BOLSTERING_BREW)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.BOLSTERING_BREW);
    emitHarbingerEffects(
      runtime,
      cast.skill,
      (profile.effects ?? []).map((effect) => ({
        ...effect,
        atMs: 0,
        audience: hasTrait(runtime, TRAIT.TWISTED_MEDICINE) ? party(runtime) : undefined
      })),
      cast
    );
  }
}

/** Doom Approaches replaces the authored control while leaving the packet timing intact. */
export function doomApproachesControl(runtime: NecromancerRuntime, effect: SkillEffect): SkillEffect {
  return effect.type === 'control' && hasTrait(runtime, TRAIT.DOOM_APPROACHES)
    ? { ...effect, controlKind: 'fear' }
    : effect;
}

/** The trait selects the pulse amount; the mechanic still accrues and expires stacks. */
export function doomApproachesBlightProfile(runtime: NecromancerRuntime) {
  return hasTrait(runtime, TRAIT.DOOM_APPROACHES) ? TRAIT.DOOM_APPROACHES : PROFILE.resources;
}

/** Only delivered boon packets expand to party recipients. */
export function twistedMedicineAudience(runtime: NecromancerRuntime, effect: SkillEffect) {
  return effect.type === 'boon' && hasTrait(runtime, TRAIT.TWISTED_MEDICINE) ? party(runtime) : effect.audience;
}

/** Harbinger capacity includes Alchemic Vigor exactly once when static build rules were not applied. */
export function initializeAlchemicVigor(runtime: NecromancerRuntime): void {
  if (!professionStaticRulesApplied(runtime.config)) {
    const vitality =
      (runtime.config.stats?.vitality ?? 1000) +
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ALCHEMIC_VIGOR), 'attributeBonus');
    runtime.profession.core.lifeForceCostMultiplier = necromancerLifeForceCostMultiplier(
      { ...runtime.config, stats: { ...runtime.config.stats, vitality } },
      runtime
    );
  }
}

/** Entry grants follow the new form state and precede the first Blight deadline. */
export function applyHarbingerEntryTraits(runtime: NecromancerRuntime, skill: Skill): void {
  if (hasTrait(runtime, TRAIT.CORRUPTED_TALENT))
    grantNecromancerLifeForce(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.CORRUPTED_TALENT), 'lifeForceGain')
    );
  applyDeathlyHaste(runtime, skill);
  if (hasTrait(runtime, TRAIT.IMPLACABLE_FOE))
    emitHarbingerEffects(runtime, skill, requireBalanceProfileFromContext(runtime, TRAIT.IMPLACABLE_FOE).effects ?? []);
}

/** Selects and materializes Doom Approaches before the skill scheduler owns the resulting pulses. */
export const doomApproachesDarkBarrage: NonNullable<Skill['effectVariants']> = [
  {
    when: (runtime) => hasTrait(runtime, TRAIT.DOOM_APPROACHES),
    profileId: PROFILE.darkBarrageDoomApproaches,
    transform: (runtime, _cast, effects) => {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.darkBarrageDoomApproaches);
      const ticks = Array.from({ length: balanceProfileNumber(profile, 'pulseCount') }, (_, index) => ({
        atMs: (index + 1) * balanceProfileNumber(profile, 'pulseInterval') * 1000
      }));
      return effects.flatMap((effect): SkillEffect[] => {
        if (effect.type === 'strike')
          return [
            {
              ...effect,
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              ticks: ticks.map((tick) => ({ ...tick, coefficient: effectNumber(profile, effect, 'coefficient') }))
            }
          ];
        if (effect.type === 'condition')
          return [
            {
              ...effect,
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              ticks: ticks.map((tick) => ({
                ...tick,
                condition: String(effect.condition),
                stacks: effectNumber(profile, effect, 'stacks'),
                duration: effectNumber(profile, effect, 'duration')
              }))
            }
          ];
        return [];
      });
    }
  }
];
