import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { effectFirstAt } from '#gw2/platform/effects/materializer.js';
import { requireBalanceNumber } from '#gw2/platform/effects/validation.js';
import type { SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { skillNumber, effectNumber, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { activeAmalgamState } from '#gw2/professions/engineer/specializations/amalgam/mechanics/modifier-queries.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  AMALGAM_MORPH_KIND_BY_SKILL_ID,
  type AmalgamMorphKind
} from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';
import { applyAmalgamStrain } from '#gw2/professions/engineer/specializations/amalgam/skills/evolved-state-skills.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import type { EngineerRuntime, EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** A committed Morph; its protocol kind is captured from the accepted skill. */
export interface AmalgamMorph {
  readonly skill: EngineerSkill;
  readonly morphKind: AmalgamMorphKind | undefined;
  readonly at: number;
}

/** The committed Morph tail: Willing Host, then protection, then the protocol strain, then New Genes boons. */
export const amalgamMorphed = defineTriggerPoint<AmalgamMorph>('engineer.amalgam-morphed', [
  TRAIT.WILLING_HOST,
  TRAIT.HARDENED_CHROME,
  TRAIT.SILVER_LINING,
  TRAIT.NEW_GENES
]);

/** Symbiotic Synergy silently resets Morph recharge before Hardened Chrome grants its longer protection. */
export const amalgamEvolved = defineTriggerPoint<Record<string, never>>('engineer.amalgam-evolved', [
  TRAIT.SYMBIOTIC_SYNERGY,
  TRAIT.HARDENED_CHROME
]);

/** Schedules six one-second Thorns Retaliation pulses when damaging-field uptime is explicitly assumed. */
function scheduleThornsRetaliation(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  // Build assumptions reach combat through the canonical runtime field; absent uptime grants no retaliation.
  if (!context.config.professionAssumptions?.inDamagingField) return;

  const hits = skillNumber(skill, 'maximumStacks');
  const interval = skillNumber(skill, 'retaliationInterval');
  for (let index = 0; index < hits; index += 1) {
    const morphsAmalgamMorphsStrike = requireEffect(
      skill,
      'strike',
      'Amalgam Morphs',
      requireSkillAction(skill, 'retaliation')
    );

    if (morphsAmalgamMorphsStrike) {
      buildEngineerPackets('damage', {
        at: at + index * interval,
        source: 'engineer',
        sourceId: skill.id,
        actorType: ACTOR.PLAYER,
        skillId: skill.id,
        skillName: skill.name,
        name: 'Thorns Retaliation',
        coefficient: effectNumber(skill, morphsAmalgamMorphsStrike, 'coefficient'),
        hits: 1,
        hitIndex: index + 1,
        totalHits: hits,
        // Retaliation shares the initial Morph hit's strength; utility strength understates its half-coefficient damage.
        skillWeapon: 'Profession mechanic'
      }).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
    }
  }
}

/** Activates the casting skill's Plasmatic State duration with its first strike. */
function activatePlasmaticState(context: EngineerRuntime, skill: EngineerSkill): void {
  const at = context.time;
  amalgamState.from(context).plasmaticStateUntil = Math.max(
    amalgamState.from(context).plasmaticStateUntil,
    at + requireBalanceNumber(skill.duration, `${skill.name} duration`)
  );
}

/** Activates Evolved, grants selected strains, and resolves Evolve trait interactions. */
function evolveAmalgam(context: EngineerRuntime, skill: EngineerSkill): void {
  const at = context.time;
  const state = amalgamState.from(context);
  // The accepted variant owns its patched lifetime independently of trait-owned attribute scaling.
  state.evolvedUntil = at + requireBalanceNumber(skill.duration, `${skill.name} duration`);

  // Silver Lining moves strains to Morph; otherwise Evolve grants every selected protocol's strain itself.
  if (!hasTrait(context.traits, TRAIT.SILVER_LINING))
    for (const id of state.selectedMorphSkillIds) applyAmalgamStrain(context, context.helpers.skillsById.get(id)!, at);

  context.fireTrigger(amalgamEvolved);
}

/** Plasmatic State strengthens eligible player packets while its accepted strain is active. */
export const plasmaticStateModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    order: 1,
    id: 'engineer.plasmatic-state',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.07,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) && activeAmalgamState(context, 'plasmaticStateUntil')
  }
]);

/** Schedule accepted form work beside its execution, preserving Core, retaliation, and Morph trait ordering. */
export const evolvedFormLifecycle: RuntimeHooks<EngineerRuntimeState, EngineerSkill> = {
  sideEffectHandlers: {
    'engineer.schedule-evolve'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Evolve requires a cast trigger.');

      const { cast } = context;
      const at = cast.start + (cast.fullEnd - cast.start) * (520 / 640);

      // Retain the accepted skill so each form reads the balance data from its own cast.
      if (at <= cast.effectiveEnd) runtime.scheduleForCast('engineer.evolve', at, cast, {}, undefined, -10);
    },
    'engineer.schedule-plasmatic'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Plasmatic State requires a cast trigger.');

      const { cast } = context;
      const strike = cast.skill.effects?.find((effect) => effect.type === 'strike');

      if (!strike) return;

      const at = effectFirstAt(cast.start, cast.fullEnd, strike);

      if (at <= cast.effectiveEnd) runtime.scheduleForCast('engineer.plasmatic-state', at, cast, {}, undefined, -10);
    },
    'engineer.morph'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Morph requires a cast trigger.');

      runtime.scheduleForCast('engineer.morph-traits', runtime.time, context.cast, {}, undefined, -101);
    },
    'engineer.thorns-retaliation'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Thorns requires a cast trigger.');

      // Core cast traits emit first; retaliation then precedes the Morph trait tail and the next completion.
      runtime.scheduleForCast('engineer.thorns-retaliation', runtime.time, context.cast, {}, undefined, -101);
    }
  },
  tasks: {
    'engineer.evolve'(runtime, data) {
      evolveAmalgam(runtime, (data as SkillTaskData<EngineerSkill>).cast.skill);
    },
    'engineer.plasmatic-state'(runtime, data) {
      activatePlasmaticState(runtime, (data as SkillTaskData<EngineerSkill>).cast.skill);
    },
    'engineer.thorns-retaliation'(runtime, data) {
      scheduleThornsRetaliation(runtime, (data as SkillTaskData<EngineerSkill>).cast.skill, runtime.time);
    },
    'engineer.morph-traits'(runtime, data) {
      const { skill } = (data as SkillTaskData<EngineerSkill>).cast;
      runtime.fireTrigger(amalgamMorphed, {
        skill,
        morphKind: AMALGAM_MORPH_KIND_BY_SKILL_ID.get(skill.id),
        at: runtime.time
      });
    }
  }
};
