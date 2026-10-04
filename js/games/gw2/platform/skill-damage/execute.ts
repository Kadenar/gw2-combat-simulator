import { createDamageExecution, DamageCalculationError } from '#gw2/platform/skill-damage/execution.js';
import { CONDITION_FORMULAS } from '#gw2/platform/combat/formulas.js';
import { runRuntime } from '#gw2/platform/simulation/runtime.js';
import { RELIC_RULES } from '#gw2/platform/equipment/relics/rules/index.js';
import { SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';
import { createSigilStrikeEvent, createSigilConditionEvent } from '#gw2/platform/equipment/sigils/proc-events.js';
import { createCriticalFoodEffect } from '#gw2/platform/resolver/equipment-reactions.js';
import type { Gw2ProfessionSource } from '#gw2/platform/simulation/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { Gw2SigilProc } from '#gw2/platform/equipment/sigils/types.js';
import type { SkillDamageOccurrence } from '#gw2/platform/skill-damage/types.js';

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
  occurrence: SkillDamageOccurrence
) {
  const inputs = occurrence.inputs ?? {};
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
  const native = source.runtimeFor(config, { traitTriggers: false });
  const effect = occurrence.effect;
  const skill = effect.kind === 'skill' ? native.catalog.skillsById.get(effect.id) : undefined;
  if (effect.kind === 'skill' && !skill)
    throw new DamageCalculationError('unsupported', 'The selected content has no implementation of this skill.');
  const profile = effect.kind === 'profile' ? native.catalog.balanceProfilesById.get(effect.id) : undefined;
  const declared =
    effect.kind === 'profession' ? native.damageEffects?.find((entry) => entry.id === effect.id) : undefined;
  const relic = effect.kind === 'relic' ? RELIC_RULES[effect.id] : undefined;
  const sigil =
    effect.kind === 'sigil' ? (SIGIL_PROCS as Readonly<Record<number, Gw2SigilProc>>)[effect.id] : undefined;
  if (
    (effect.kind === 'profile' && !profile) ||
    (effect.kind === 'profession' && !declared) ||
    (effect.kind === 'relic' && !relic?.damagePayload) ||
    (effect.kind === 'sigil' && !sigil)
  )
    throw new DamageCalculationError('unsupported', 'Damage calculation not implemented for this effect.');

  const belongs = (event: SimulationEventBase): boolean => {
    if (event.actorType === 'summon' || event.summonOwner != null) return false;
    if (effect.kind === 'skill')
      return (
        !['Trait', 'Relic', 'Sigil', 'Rune', 'Food'].includes(event.source) &&
        event.procType !== 'profession' &&
        (event.skillId === effect.id ||
          event.sourceId === effect.id ||
          event.activationId?.startsWith('cast:') === true)
      );
    if (effect.kind === 'profile')
      return event.source === 'Trait' && (event.sourceId === effect.ownerId || event.sourceId === effect.id);
    if (effect.kind === 'relic')
      return event.source === 'Relic' && (event.sourceId === effect.id || event.sourceId === `relic.${effect.id}`);
    if (effect.kind === 'sigil') return event.sourceId === `sigil.${effect.id}`;
    if (effect.kind === 'food') return event.source === 'Food';
    return declared?.sourceIds.includes(event.sourceId) === true;
  };

  const accepts = (event: SimulationEventBase) => belongs(event) || String(event.sourceId).startsWith('assumption.');
  const emit = (runtime: Gw2Runtime) => {
    if (profile && effect.kind === 'profile')
      runtime.effects.emit({
        kind: 'profile',
        profile,
        attribution: {
          source: 'Trait',
          sourceId: effect.ownerId,
          actorType: 'effect',
          ownerActorType: 'player',
          skillName: occurrence.name,
          activationId: 'damage:occurrence'
        }
      });
    else if (relic?.damagePayload && effect.kind === 'relic') {
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
          actorType: 'effect',
          skillName: occurrence.name
        },
        inputs
      );
    } else if (sigil && effect.kind === 'sigil') {
      if (['strike', 'strike-condition'].includes(sigil.effect))
        runtime.effects.emit({ kind: 'packet', event: createSigilStrikeEvent(effect.id, sigil, occurrence.name) });
      if (['condition', 'strike-condition', 'next-hit-condition'].includes(sigil.effect))
        runtime.effects.emit({ kind: 'packet', event: createSigilConditionEvent(effect.id, sigil, occurrence.name) });
    } else if (effect.kind === 'food')
      createCriticalFoodEffect(runtime, {
        type: 'proc',
        at: 0,
        source: 'Food',
        sourceId: effect.id,
        actorType: 'effect',
        skillName: occurrence.name
      });
    else if (declared) declared.emit(runtime, inputs);
  };

  const result = runRuntime({
    profession: native,
    config,
    output: 'damage',
    ownsEffect: belongs,
    execution: createDamageExecution(native, {
      skillId: skill?.id,
      cast: occurrence.cast,
      accepts,
      emit,
      initialize(runtime) {
        if (skill)
          native.prepareDamageState?.(runtime, skill, {
            ...inputs,
            ...(occurrence.cast?.releaseAtCharges == null ? {} : { charges: occurrence.cast.releaseAtCharges })
          });
      }
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
