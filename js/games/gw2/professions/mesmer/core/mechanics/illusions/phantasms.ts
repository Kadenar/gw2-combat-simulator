/** Own accepted phantasm batches, packet dispatch, and conversion ordering behind one scheduling operation. */
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { ACTOR } from '#gw2/platform/constants.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { referenceCastTimeMs } from '#gw2/platform/execution/cast-timing.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  schedulePhantasmBonusStrike,
  schedulePhantasmStatuses,
  schedulePhantasmStrike
} from '#gw2/professions/mesmer/core/mechanics/illusions/phantasm-attacks.js';
import type {
  MesmerPhantasmAttackTiming,
  MesmerPhantasmExecution,
  MesmerPhantasmPolicy,
  MesmerQueueResources
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { buildMesmerPacket } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { mesmerIllusionsGained } from '#gw2/professions/mesmer/core/mechanics/resources.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerConditionEffect, MesmerSkill, MesmerStrikeEffect } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Each accepted summon batch captures its trait work before timing and conversion are committed. */
export interface MesmerPhantasmTraitEffects {
  repeat?: MesmerPhantasmPolicy['repeat'];
  bonusStrike?: MesmerPhantasmPolicy['bonusStrike'];
}

export const mesmerPhantasmPreparing = defineTriggerPoint<MesmerPhantasmTraitEffects>('mesmer.phantasm-preparing', [
  TRAIT.CHRONOPHANTASMA,
  TRAIT.PHANTASMAL_BLADES
]);

interface PhantasmScheduleOptions {
  readonly delivery: EffectDelivery;
  readonly clarityConsumed: boolean;
}

interface PhantasmCastSchedulerOptions {
  readonly state: MesmerRuntime;
  readonly phantasmTimingFor: (skillId: number) => MesmerPhantasmAttackTiming | undefined;
  readonly phantasmPolicy: () => MesmerPhantasmPolicy;
  readonly queueResources: MesmerQueueResources;
}

/** Same-tick transitions grant one batch. A later phantasm earns its own trait or resource grant. */
function phantasmCountsAt(executions: readonly MesmerPhantasmExecution[], phase: 'spawnAt' | 'conversionAt') {
  const counts = new Map<number, number>();
  for (const execution of executions) {
    const at = gw2Time(execution[phase]);
    counts.set(at, (counts.get(at) ?? 0) + 1);
  }

  return counts;
}

/** Schedule phantasm lifecycles, attacks, and resource conversions independently of the caster's effects. */
export function createPhantasmCastScheduler({
  state,
  phantasmTimingFor,
  phantasmPolicy,
  queueResources
}: PhantasmCastSchedulerOptions) {
  const prepare = (
    skill: MesmerSkill,
    summonAt: number,
    clarityConsumed: boolean,
    delivery: EffectDelivery = {}
  ): readonly MesmerPhantasmExecution[] => {
    if (skill.resource?.mode !== 'phantasm') return [];

    // Skill-owned summon counts use the accepted Clarity snapshot before trait spawn policies.
    const traitEffects: MesmerPhantasmTraitEffects = {};
    state.fireTrigger(mesmerPhantasmPreparing, traitEffects);
    const policy = { ...phantasmPolicy(), repeat: traitEffects.repeat, bonusStrike: traitEffects.bonusStrike };
    const spawnModifier = policy.spawnModifiers[skill.id];
    const count =
      (clarityConsumed ? (skill.resource.clarityCount ?? skill.resource.count ?? 1) : (skill.resource.count ?? 1)) *
      (spawnModifier?.countMultiplier ?? 1);

    // One resolved timing record belongs to this activation's entire summon batch.
    const timing = phantasmTimingFor(skill.id);

    if (!timing) {
      throw new TypeError(`Phantasm skill ${skill.id} requires attack timing metadata.`);
    }

    // Profiles measure from the end of a reference cast. Convert to time since NPC release once.
    const referenceRecoveryMs = referenceCastTimeMs(skill) * (1 - (skill.phantasmSummonProgress ?? 1));
    const endpoint = (atMs: number | undefined): number => summonAt + (referenceRecoveryMs + Number(atMs)) / 1000;

    const hasRepeat = Boolean(policy.repeat);

    // Each entity in the spawn batch gets its own execution so per-entity timing
    // offsets preserve staggered attacks and clone availability at shatter boundaries.
    return Array.from({ length: count }, (_, entityIndex) => {
      const damageAt = endpoint(timing.damageAtMsByEntity?.[entityIndex] ?? timing.damageAtMs);
      const spawnAt = endpoint(timing.spawnAtMsByEntity?.[entityIndex] ?? timing.spawnAtMs);
      const repeatDamageAt = endpoint(timing.repeatDamageAtMsByEntity?.[entityIndex] ?? timing.repeatDamageAtMs);
      // Blade ticks table may have fewer entries than phantasm count; clamp to last entry.
      const conversionTick = timing.conversionTicks?.[Math.min(entityIndex, timing.conversionTicks.length - 1)];
      return {
        policy,
        delivery,
        skill,
        entityIndex,
        damageMultiplier: spawnModifier?.damageMultiplier ?? 1,
        summonAt,
        damageAt,
        spawnAt,
        repeatDamageAt,
        // Resolve conversion once so resource grouping and observation share the same instant.
        // Repeat conversion takes precedence over specialization blade-tick timing.
        conversionAt: hasRepeat
          ? endpoint(timing.repeatSpawnAtMsByEntity?.[entityIndex] ?? timing.repeatSpawnAtMs)
          : policy.conversionTiming === 'blade-tick' && conversionTick
            ? endpoint(conversionTick.atMs)
            : spawnAt,
        initialBladeAt: gw2Time(
          timing.phantasmalBladeDelayAfterSpawnMs != null
            ? spawnAt + timing.phantasmalBladeDelayAfterSpawnMs / 1000
            : damageAt
        ),
        timing,
        endpoint
      };
    });
  };

  const scheduleLifecycle = (executions: readonly MesmerPhantasmExecution[]): void => {
    const execution = executions[0];

    if (!execution) return;

    const { skill } = execution;
    const count = executions.length;
    const policy = execution.policy;

    // Lifecycle events use the latest entity's timestamp so the "complete" marker
    // fires after every entity in the batch has finished attacking. They retain explicit phantasm ownership.
    const damageAt = Math.max(...executions.map((item) => item.damageAt));
    const repeatDamageAt = Math.max(...executions.map((item) => item.repeatDamageAt));
    const initialBladeAt = Math.max(...executions.map((item) => item.initialBladeAt));

    state.fireTrigger(mesmerIllusionsGained, {
      at: execution.summonAt,
      count,
      sourceSkill: skill.name,
      detail: `${count} phantasm${count === 1 ? '' : 's'}`,
      delivery: execution.delivery
    });

    {
      const packet = buildMesmerPacket({
        type: 'mesmer.phantasm-summoned',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        at: execution.summonAt,
        name: skill.name,
        count,
        // Expose each scheduled resource deadline, including staggered Chronophantasma conversions, for cursor inspection.
        conversionTimes: executions.map((item) => gw2Time(item.conversionAt))
      });
      state.effects.emit({
        ...execution.delivery,
        kind: 'packet',
        event: packet
      });
    }

    {
      const packet = buildMesmerPacket({
        type: 'mesmer.phantasm-attack',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        at: damageAt,
        name: skill.name,
        count,
        // The marker type identifies completion; repeat distinguishes the second attack in the event log.
        repeat: false
      });
      state.effects.emit({
        ...execution.delivery,
        kind: 'packet',
        event: packet
      });
    }

    if (policy.bonusStrike) {
      // Each entity fires its specialization-defined bonus strike at its own initial timestamp.
      for (const item of executions) {
        schedulePhantasmBonusStrike(state, item, item.initialBladeAt);
      }

      state.effects.emit({
        ...execution.delivery,
        kind: 'announcement',
        log: true,
        attribution: { source: 'Trait', sourceId: policy.bonusStrike.traitId, actorType: ACTOR.EFFECT },
        announcement: {
          type: 'trait',
          name: policy.bonusStrike.traitName,
          at: initialBladeAt,
          sourceSkill: skill.name,
          detail: ''
        }
      });
    }

    if (!policy.repeat) return;

    for (const [at, resummoned] of phantasmCountsAt(executions, 'spawnAt')) {
      state.fireTrigger(mesmerIllusionsGained, {
        at,
        count: resummoned,
        sourceSkill: `${skill.name} - ${policy.repeat.label}`,
        detail: `${resummoned} phantasm${resummoned === 1 ? '' : 's'}`,
        delivery: execution.delivery
      });
      const packet = buildMesmerPacket({
        type: 'mesmer.phantasm-resummoned',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        at,
        name: skill.name,
        count: resummoned
      });
      state.effects.emit({
        ...execution.delivery,
        kind: 'packet',
        event: packet
      });
    }

    {
      const packet = buildMesmerPacket({
        type: 'mesmer.phantasm-attack',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        at: repeatDamageAt,
        name: skill.name,
        count,
        repeat: true
      });
      state.effects.emit({
        ...execution.delivery,
        kind: 'packet',
        event: packet
      });
    }

    state.effects.emit({
      ...execution.delivery,
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: policy.repeat.traitId, actorType: ACTOR.EFFECT },
      announcement: {
        type: 'trait',
        name: policy.repeat.traitName,
        at: execution.spawnAt,
        sourceSkill: skill.name,
        detail: ''
      }
    });
  };

  const schedulePackets = (
    skill: MesmerSkill,
    castStart: number,
    phantasmExecutions: readonly MesmerPhantasmExecution[]
  ): void => {
    const strikeEffects = (skill.effects || []).filter(
      (effect): effect is MesmerStrikeEffect => effect.type === 'strike' && effect.summonKind === 'phantasm'
    );
    for (const group of strikeEffects) {
      if (phantasmExecutions.length === 0) {
        throw new TypeError(`Phantasm strike ${skill.id} requires phantasm resource metadata.`);
      }

      for (const phantasm of phantasmExecutions) {
        schedulePhantasmStrike(state, phantasm, group, castStart);
      }
    }

    const phantasmConditions = (skill.effects || []).filter(
      (effect): effect is MesmerConditionEffect => effect.type === 'condition' && effect.summonKind === 'phantasm'
    );
    for (const phantasm of phantasmExecutions) {
      schedulePhantasmStatuses(state, phantasm, phantasmConditions);
    }
  };

  const schedule = (
    skill: MesmerSkill,
    summonAt: number,
    castStart: number,
    { clarityConsumed, delivery }: PhantasmScheduleOptions
  ): void => {
    // The cast owner selects the summon instant; this scheduler owns only the resulting summon work.
    const phantasmExecutions = prepare(skill, summonAt, clarityConsumed, delivery);
    scheduleLifecycle(phantasmExecutions);
    schedulePackets(skill, castStart, phantasmExecutions);
    for (const [at, count] of phantasmCountsAt(phantasmExecutions, 'conversionAt')) {
      queueResources(
        at,
        count,
        null,
        `${skill.name} phantasm conversion`,
        {
          kind: 'phantasm-conversion',
          sourceSkillId: skill.id
        },
        delivery
      );
    }
  };

  return { schedule };
}
