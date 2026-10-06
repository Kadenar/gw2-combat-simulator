import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import type { EffectMetadata, SimulationEvent } from '#gw2/platform/events/events.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

import { necromancerLifeForceCostMultiplier } from '#gw2/professions/necromancer/core/state.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { party } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/audiences.js';
import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import { harbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { darkBarrageEffects } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/dark-barrage.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

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
  const skill = event.skillId == null ? undefined : context.helpers.skillsById.get(event.skillId);
  // Doom Approaches Vulnerability applies only on the first hit of Tainted Bolts, not each chain projectile.
  const firstHit = Number(event.hitIndex || 1) === 1;
  if (hasTrait(context, TRAIT.DOOM_APPROACHES) && firstHit && skill?.id === ID.TAINTED_BOLTS) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.DOOM_APPROACHES);
    const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
    if (vulnerability) {
      /* Trait payloads and their timeline annotation share the same emission boundary. */ context.effects.emit({
        kind: 'packet',
        event: {
          at: event.at,
          source: 'Trait',
          sourceId: TRAIT.DOOM_APPROACHES,
          actorType: 'effect',
          skillName: 'Doom Approaches',
          triggeredBy: event.skillName,
          type: 'condition',
          name: 'Doom Approaches',
          condition: 'Vulnerability',
          stacks: effectNumber(profile, vulnerability, 'stacks'),
          duration: effectNumber(profile, vulnerability, 'duration')
        }
      });
      context.effects.emit({
        kind: 'announcement',
        announcement: { type: 'trait', name: 'Doom Approaches', at: event.at, sourceSkill: event.skillName }
      });
    }
  }

  // Septic Corruption procs on shroud slot 2 specifically (the pistol #2 skill), not all pistol hits.
  if (hasTrait(context, TRAIT.SEPTIC_CORRUPTION) && skill?.shroudSlot === 2) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.SEPTIC_CORRUPTION);
    const condition = requireEffect(profile, 'condition', 'Poisoned');
    if (condition) {
      /* Trait payloads and their timeline annotation share the same emission boundary. */ context.effects.emit({
        kind: 'packet',
        settlement: 'reaction',
        event: {
          at: event.at,
          source: 'Trait',
          sourceId: TRAIT.SEPTIC_CORRUPTION,
          actorType: 'effect',
          skillName: 'Septic Corruption',
          triggeredBy: event.skillName,
          type: 'condition',
          ownerActorType: 'player',
          name: 'Septic Corruption' + ' - ' + String(condition.condition),
          condition: String(condition.condition),
          stacks: effectNumber(profile, condition, 'stacks'),
          duration: effectNumber(profile, condition, 'duration')
        }
      });
      context.effects.emit({
        kind: 'announcement',
        announcement: { type: 'trait', name: 'Septic Corruption', at: event.at, sourceSkill: event.skillName }
      });
    }
  }
}

export const harbingerResolverEventReactions = Object.freeze({
  damage: reactToDamage
});

/** Entry and completed Dark Barrage independently deliver the surviving trait boons. */
export function applyDeathlyHaste(runtime: NecromancerRuntime, skill: Skill): void {
  if (!hasTrait(runtime, TRAIT.DEATHLY_HASTE)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.DEATHLY_HASTE);
  {
    // Shared emission owns transport; the mechanic selects attribution and delivery.
    const emissionRuntime: NecromancerRuntime = runtime;
    const emissionSkill: Skill = skill;
    const emissionEffects: readonly SkillEffect[] = (profile.effects ?? []).map((effect) => ({
      ...effect,
      audience: party(runtime),
      source: 'Trait',
      sourceId: TRAIT.DEATHLY_HASTE
    }));

    const emissionMetadata: EffectMetadata | undefined = undefined;
    const emissionCause: SimulationEvent | undefined = undefined;

    emissionRuntime.effects.emit({
      kind: 'profile',
      cause: emissionCause,
      profile: emissionSkill,
      effects: emissionEffects,
      attribution: (effect) => ({
        source: effect.source ?? (emissionSkill.type === 'Trait' ? 'Trait' : 'necromancer'),
        sourceId: effect.sourceId ?? emissionSkill.id,
        skillId: emissionSkill.id,
        skillName: emissionSkill.name,
        actorType: effect.actorType ?? (emissionSkill.type === 'Trait' ? 'effect' : 'player'),
        metadata: emissionMetadata
      }),
      skillWeaponFallback: 'Unequipped',
      transform: (event) => ({
        ...event,
        ...(event.type === 'damage' ? { name: emissionSkill.name } : {}),
        ...(event.type === 'condition' ? { name: emissionSkill.name + ' — ' + event.condition } : {}),
        at: event.at
      })
    });
  }
}

/** Consumed stacks claim one Meltdown threshold before the mechanic publishes the remaining Blight. */
export function applyCascadingCorruption(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  consumed: number
): void {
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
      const threshold = balanceProfileNumber(corruption, 'minimumStacks');
      // Reaching the stack cap grants one Meltdown and resets buildup before any reward reacts.
      const progress = advanceCounter(state.cascadingCorruptionStacks, consumed, threshold, 'reset');
      state.cascadingCorruptionStacks = progress.value;
      if (progress.reached) {
        if (meltdown)
          state.meltdownUntil = canonicalTime(runtime.time + effectNumber(corruption, meltdown, 'duration'));
        const proc = runtime.effects.emit({
          receipt: true,
          kind: 'announcement',
          log: true,
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.CASCADING_CORRUPTION,
            actorType: 'effect',
            activationId: cast.id
          },
          announcement: {
            type: 'trait',
            at: runtime.time,
            name: 'Meltdown',
            icon: 'https://wiki.guildwars2.com/wiki/Special:FilePath/Meltdown.png',
            sourceSkill: cast.skill.name
          }
        });
        {
          // Shared emission owns transport; the mechanic selects attribution and delivery.
          const emissionRuntime: NecromancerRuntime = runtime;
          const emissionSkill: Skill = { id: ID.CASCADING_CORRUPTION, name: 'Cascading Corruption', type: 'Trait' };
          const emissionEffects: readonly SkillEffect[] = [meltdown, strike, torment]
            .filter((effect) => effect != null)
            .map((effect) => ({
              ...effect,
              sourceId: TRAIT.CASCADING_CORRUPTION,
              atMs: quantizeGw2ActionTimingMs(effect.atMs ?? 0)
            }));
          const emissionCast = cast;
          const emissionMetadata: EffectMetadata | undefined = undefined;
          const emissionCause: SimulationEvent | undefined = proc;

          emissionRuntime.effects.emit({
            kind: 'profile',
            cause: emissionCause,
            profile: emissionSkill,
            effects: emissionEffects,
            attribution: (effect) => ({
              source: effect.source ?? (emissionSkill.type === 'Trait' ? 'Trait' : 'necromancer'),
              sourceId: effect.sourceId ?? emissionSkill.id,
              skillId: emissionSkill.id,
              skillName: emissionSkill.name,
              actorType: effect.actorType ?? (emissionSkill.type === 'Trait' ? 'effect' : 'player'),
              activationId:
                emissionSkill.id !== emissionCast.skill.id
                  ? emissionCast.id + ':effect:' + emissionSkill.id
                  : emissionCast.id,
              metadata: emissionMetadata
            }),
            skillWeaponFallback: 'Unequipped',
            transform: (event) => ({
              ...event,
              parentSkillName: emissionCast.skill.id !== emissionSkill.id ? emissionCast.skill.name : undefined,
              ...(event.type === 'damage' ? { name: emissionSkill.name } : {}),
              ...(event.type === 'condition' ? { name: emissionSkill.name + ' — ' + event.condition } : {}),
              offTarget: emissionCast.command.offTarget,
              at: canonicalTime(
                event.at +
                  (emissionSkill.id === emissionCast.skill.id && isHostileTargetEvent(event)
                    ? (emissionCast.command.impactDelayMs ?? 0) / 1000
                    : 0)
              )
            })
          });
        }
      }
    }
  }
}

/** Elixir boons are chosen at launch, after the shared Blight transaction. */
export function applyBolsteringBrew(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  if (hasTrait(runtime, TRAIT.BOLSTERING_BREW)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.BOLSTERING_BREW);
    {
      // Shared emission owns transport; the mechanic selects attribution and delivery.
      const emissionRuntime: NecromancerRuntime = runtime;
      const emissionSkill: Skill = cast.skill;
      const emissionEffects: readonly SkillEffect[] = (profile.effects ?? []).map((effect) => ({
        ...effect,
        atMs: 0,
        // Elixir casting owns the timing; Bolstering Brew owns these additional grants.
        source: 'Trait',
        sourceId: TRAIT.BOLSTERING_BREW,
        audience: hasTrait(runtime, TRAIT.TWISTED_MEDICINE) ? party(runtime) : undefined
      }));
      const emissionCast = cast;
      const emissionMetadata: EffectMetadata | undefined = undefined;
      const emissionCause: SimulationEvent | undefined = undefined;

      emissionRuntime.effects.emit({
        kind: 'profile',
        cause: emissionCause,
        profile: emissionSkill,
        effects: emissionEffects,
        attribution: (effect) => ({
          source: effect.source ?? (emissionSkill.type === 'Trait' ? 'Trait' : 'necromancer'),
          sourceId: effect.sourceId ?? emissionSkill.id,
          skillId: emissionSkill.id,
          skillName: emissionSkill.name,
          actorType: effect.actorType ?? (emissionSkill.type === 'Trait' ? 'effect' : 'player'),
          activationId:
            emissionSkill.id !== emissionCast.skill.id
              ? emissionCast.id + ':effect:' + emissionSkill.id
              : emissionCast.id,
          metadata: emissionMetadata
        }),
        skillWeaponFallback: 'Unequipped',
        transform: (event) => ({
          ...event,
          parentSkillName: emissionCast.skill.id !== emissionSkill.id ? emissionCast.skill.name : undefined,
          ...(event.type === 'damage' ? { name: emissionSkill.name } : {}),
          ...(event.type === 'condition' ? { name: emissionSkill.name + ' — ' + event.condition } : {}),
          offTarget: emissionCast.command.offTarget,
          at: canonicalTime(
            event.at +
              (emissionSkill.id === emissionCast.skill.id && isHostileTargetEvent(event)
                ? (emissionCast.command.impactDelayMs ?? 0) / 1000
                : 0)
          )
        })
      });
    }
  }
}

/** Doom Approaches turns the shroud control into Fear so condition duration and Fear reactions apply. */
export function doomApproachesControl(runtime: NecromancerRuntime, effect: SkillEffect): SkillEffect {
  if (effect.type !== 'control' || !hasTrait(runtime, TRAIT.DOOM_APPROACHES)) return effect;
  const fields = { ...effect };
  delete fields.controlKind;
  return { ...fields, type: 'condition', condition: 'Fear', stacks: 1, duration: 1 };
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
  if (hasTrait(runtime, TRAIT.IMPLACABLE_FOE)) {
    // Shared emission owns transport; the mechanic selects attribution and delivery.
    const emissionRuntime: NecromancerRuntime = runtime;
    const emissionSkill: Skill = skill;
    const emissionEffects: readonly SkillEffect[] = (
      requireBalanceProfileFromContext(runtime, TRAIT.IMPLACABLE_FOE).effects ?? []
    ).map((effect) => ({
      ...effect,
      // Keep the shroud entry as the trigger while naming the trait that grants Stability.
      source: 'Trait',
      sourceId: TRAIT.IMPLACABLE_FOE
    }));

    const emissionMetadata: EffectMetadata | undefined = undefined;
    const emissionCause: SimulationEvent | undefined = undefined;

    emissionRuntime.effects.emit({
      kind: 'profile',
      cause: emissionCause,
      profile: emissionSkill,
      effects: emissionEffects,
      attribution: (effect) => ({
        source: effect.source ?? (emissionSkill.type === 'Trait' ? 'Trait' : 'necromancer'),
        sourceId: effect.sourceId ?? emissionSkill.id,
        skillId: emissionSkill.id,
        skillName: emissionSkill.name,
        actorType: effect.actorType ?? (emissionSkill.type === 'Trait' ? 'effect' : 'player'),
        metadata: emissionMetadata
      }),
      skillWeaponFallback: 'Unequipped',
      transform: (event) => ({
        ...event,
        ...(event.type === 'damage' ? { name: emissionSkill.name } : {}),
        ...(event.type === 'condition' ? { name: emissionSkill.name + ' — ' + event.condition } : {}),
        at: event.at
      })
    });
  }
}

/** Selects and materializes Doom Approaches before the skill scheduler owns the resulting pulses. */
export const doomApproachesDarkBarrage: NonNullable<Skill['effectVariants']> = [
  {
    when: (runtime) => hasTrait(runtime, TRAIT.DOOM_APPROACHES),
    profileId: PROFILE.darkBarrageDoomApproaches,
    transform: (runtime, _cast, effects) => {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.darkBarrageDoomApproaches);
      return darkBarrageEffects(profile, effects);
    }
  }
];
