import { CONDITION_FORMULAS } from '#gw2/platform/combat/formulas.js';
import { ACTOR } from '#gw2/platform/constants.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { createCriticalFoodEffect } from '#gw2/platform/equipment/consumables/food-procs.js';
import { RELIC_RULES } from '#gw2/platform/equipment/relics/rules/index.js';
import { SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';
import { createSigilDamagePayload } from '#gw2/platform/equipment/sigils/proc-events.js';
import type { Gw2SigilProc } from '#gw2/platform/equipment/sigils/types.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';
import { isTraitEffect } from '#gw2/platform/profession-definition/trait-emission.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import { runRuntime } from '#gw2/platform/simulation/runtime.js';
import { DamageCalculationError } from '#gw2/platform/skill-damage/errors.js';
import { certainTraitRandom, createDamageExecution } from '#gw2/platform/skill-damage/occurrence-driver.js';
import type { DamageInputs, SkillDamageOccurrence } from '#gw2/platform/skill-damage/types.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';

/** Content declarations identify damaging effects even when the selected inputs resolve to zero. */
export function hasDamage(effects: readonly SkillEffect[] | undefined): boolean {
  return (effects ?? []).some(
    (effect) =>
      effect.type === 'strike' ||
      (effect.type === 'condition' &&
        (Object.hasOwn(CONDITION_FORMULAS, String(effect.condition)) ||
          effect.ticks?.some((tick) => Object.hasOwn(CONDITION_FORMULAS, tick.condition)))) ||
      (effect.type === 'custom' && effect.eventType === 'damage')
  );
}

/** Execute one known payload below eligibility, retaining native scheduling, effect transforms, and damage diagnostics. */
export function executeDamageOccurrence(
  source: Gw2ProfessionSource,
  baseConfig: Gw2Config,
  occurrence: SkillDamageOccurrence,
  sharedInputs: DamageInputs = {}
) {
  const inputs = { ...sharedInputs, ...occurrence.inputs };
  for (const value of Object.values(occurrence.cast ?? {}))
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0))
      throw new DamageCalculationError('missing-input', 'Cast damage inputs must be finite and non-negative.');
  for (const [key, value] of Object.entries(inputs))
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0))
      throw new DamageCalculationError('missing-input', `${key} must be finite and non-negative.`);

  const config: Gw2Config = structuredClone({
    ...baseConfig,
    ...occurrence.config?.profession,
    ...(occurrence.config?.startingWeaponSet == null ? {} : { startingWeaponSet: occurrence.config.startingWeaponSet }),
    ...(occurrence.config?.initialResource == null ? {} : { initialResource: occurrence.config.initialResource }),
    target: { ...baseConfig.target, health: 0 }
  });
  const effect = occurrence.effect;
  // Only skill rows opt into native trait triggers; standalone proc rows still measure a single payload.
  const includeTraitProcs = effect.kind === 'skill' && Boolean(inputs.includeTraitProcs);
  const native = source.runtimeFor(config, { traitTriggers: includeTraitProcs });
  const skill = effect.kind === 'skill' ? native.catalog.skillsById.get(effect.id) : undefined;

  if (effect.kind === 'skill' && !skill)
    throw new DamageCalculationError('unsupported', 'The selected content has no implementation of this skill.');

  const declared =
    effect.kind === 'profession' ? native.damageEffects?.find((entry) => entry.id === effect.id) : undefined;
  const relic = effect.kind === 'relic' ? RELIC_RULES[effect.id] : undefined;
  const sigil =
    effect.kind === 'sigil' ? (SIGIL_PROCS as Readonly<Record<number, Gw2SigilProc>>)[effect.id] : undefined;

  if (
    (effect.kind === 'profession' && !declared) ||
    (effect.kind === 'relic' && !relic?.damagePayload) ||
    (effect.kind === 'sigil' && !sigil)
  )
    throw new DamageCalculationError('unsupported', 'Damage calculation not implemented for this effect.');

  const belongs = (event: SimulationEventBase): boolean => {
    if (event.actorType === ACTOR.SUMMON || event.summonOwner != null) return false;

    // Trait-owned packets, including those emitted inline by the skill's own execution, belong to a skill row only
    // when it includes trait procs; ownership outranks the skill attribution and procType exclusions below.
    if (effect.kind === 'skill' && isTraitEffect(event)) return includeTraitProcs;

    if (effect.kind === 'skill')
      return (
        !['Trait', 'Relic', 'Sigil', 'Rune', 'Food'].includes(event.source) &&
        // Only allied grants extend skill ownership to profession procs; unrelated personal reactions stay excluded.
        (event.procType !== 'profession' ||
          (event.metadata?.triggeredByAlly != null && event.sourceId === effect.id)) &&
        (event.skillId === effect.id ||
          event.sourceId === effect.id ||
          event.activationId?.startsWith('cast:') === true)
      );

    if (effect.kind === 'relic')
      return event.source === 'Relic' && (event.sourceId === effect.id || event.sourceId === `relic.${effect.id}`);

    if (effect.kind === 'sigil') return event.sourceId === `sigil.${effect.id}`;

    if (effect.kind === 'food') return event.source === 'Food';

    return declared?.sourceIds.includes(event.sourceId) === true;
  };

  const accepts = (event: SimulationEventBase) =>
    belongs(event) ||
    String(event.sourceId).startsWith('assumption.') ||
    // Included trait procs run in combat from time zero, so the scheduled combat start must enter the runtime.
    (includeTraitProcs && event.type === 'combat_start');
  const emit = (runtime: Gw2Runtime) => {
    if (relic?.damagePayload && effect.kind === 'relic') {
      // A precast occurrence mutates its own state, so its payload's bonuses remain owned by that relic.
      const owner = [runtime.relic, ...(runtime.precastRelics ?? [])].find((entry) => entry.id === effect.id);

      if (!owner) throw new DamageCalculationError('missing-input', 'Select the relic in the build or precast relics.');

      relic.damagePayload(
        runtime,
        owner.state,
        {
          type: 'proc',
          at: runtime.time,
          source: 'Relic',
          sourceId: effect.id,
          actorType: ACTOR.EFFECT,
          skillName: occurrence.name
        },
        inputs
      );
    } else if (sigil && effect.kind === 'sigil') {
      // Isolated measurement evaluates the earned payload directly, including Doom's eventual next-hit condition.
      for (const event of createSigilDamagePayload(effect.id, sigil, occurrence.name))
        runtime.effects.emit({ kind: 'packet', event });
    } else if (effect.kind === 'food')
      createCriticalFoodEffect(runtime, {
        type: 'proc',
        at: 0,
        source: 'Food',
        sourceId: effect.id,
        actorType: ACTOR.EFFECT,
        skillName: occurrence.name
      });
    else if (declared) declared.emit(runtime.mechanics, inputs);
  };

  const result = runRuntime({
    profession: native,
    config,
    // Trait contributions model an activation in combat, including non-damaging actions such as attunement swaps.
    combatStartTime: includeTraitProcs ? 0 : undefined,
    output: 'damage',
    ownsEffect: belongs,
    execution: createDamageExecution(native, {
      skillId: skill?.id,
      includeTraitProcs,
      random: includeTraitProcs ? certainTraitRandom(createSimulationRandom(config.randomness)) : undefined,
      cast: occurrence.cast,
      accepts,
      emit,
      inputs
    })
  });

  if (!result.complete)
    throw new DamageCalculationError(
      'unsupported',
      'The effect exceeds the finite calculation window; choose a pulse or finite duration.'
    );

  const { events, castSeconds } = result;
  return {
    events,
    catalog: native.catalog,
    castSeconds,
    damaging:
      effect.kind !== 'skill' ||
      hasDamage(skill?.effects) ||
      events.some(
        (event) =>
          event.type === 'damage' || (event.type === 'condition' && Object.hasOwn(CONDITION_FORMULAS, event.condition))
      )
  };
}
