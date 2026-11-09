/** Own accepted phantasm batches, packet dispatch, and conversion ordering behind one scheduling operation. */
import { ACTOR } from '#gw2/platform/constants.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { castRelativeEffectTimingScale } from '#gw2/platform/execution/cast-timing.js';
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
import {
  buildMesmerConditions,
  buildMesmerPacket,
  buildMesmerStrikes
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { mesmerIllusionsGained } from '#gw2/professions/mesmer/core/mechanics/resources.js';
import { phantasmalHasteSpeed } from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerConditionEffect, MesmerSkill, MesmerStrikeEffect } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

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
  readonly delivery?: EffectDelivery;
  readonly clarityConsumed?: boolean;
  readonly phantasmSummonAt?: number;
  readonly playerEffectEnd?: number;
}

interface PhantasmCastSchedulerOptions {
  readonly state: MesmerRuntime;
  readonly phantasmTimingFor: (skillId: number) => MesmerPhantasmAttackTiming | undefined;
  readonly phantasmPolicy: () => MesmerPhantasmPolicy;
  readonly queueResources: MesmerQueueResources;
}

/** Schedule player strikes and conditions, phantasm lifecycles and attacks, and their resource conversions. */
export function createPhantasmCastScheduler({
  state,
  phantasmTimingFor,
  phantasmPolicy,
  queueResources
}: PhantasmCastSchedulerOptions) {
  const prepare = (
    skill: MesmerSkill,
    castStart: number,
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

    // Phantasmal Haste compresses all post-cast timing offsets by 1/speed.
    const speed = phantasmalHasteSpeed(state);
    const endpoint = (atMs: number | undefined): number => {
      const measuredPostCast = Number(atMs) / 1000;
      const actualCastTime = summonAt - castStart;
      return castStart + actualCastTime + measuredPostCast / speed;
    };

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
        initialBladeAt:
          timing.phantasmalBladeDelayAfterSpawnMs != null
            ? spawnAt + timing.phantasmalBladeDelayAfterSpawnMs / 1000
            : damageAt,
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
        conversionTimes: executions.map((item) => canonicalTime(item.conversionAt))
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

    // Chronophantasma repeats the attack; Virtuoso's bonus blades cannot share this specialization.
    state.fireTrigger(mesmerIllusionsGained, {
      at: execution.spawnAt,
      count,
      sourceSkill: `${skill.name} - ${policy.repeat.label}`,
      detail: `${count} phantasm${count === 1 ? '' : 's'}`,
      delivery: execution.delivery
    });

    {
      const packet = buildMesmerPacket({
        type: 'mesmer.phantasm-resummoned',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        at: execution.spawnAt,
        name: skill.name,
        count
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

  const queueConversion = (execution: MesmerPhantasmExecution, amount = 1): void => {
    // Resource tasks use their real conversion time; task priority keeps them after same-time illusion work.
    queueResources(
      execution.conversionAt,
      amount,
      null,
      `${execution.skill.name} phantasm conversion`,
      {
        kind: 'phantasm-conversion',
        sourceSkillId: execution.skill.id
      },
      execution.delivery
    );
  };

  const schedulePlayerStrike = (
    skill: MesmerSkill,
    group: MesmerStrikeEffect,
    at: number,
    castStart: number,
    delivery: EffectDelivery
  ): void => {
    const castScale =
      group.timingScale === 'cast' ? castRelativeEffectTimingScale(skill, Math.max(0, at - castStart) * 1000) : 1;
    // Mesmer's replacing handler materializes its own packets, so project the
    // same Quickness-authored timing that the shared scheduler would use.
    const timedGroup: Partial<MesmerStrikeEffect> =
      castScale === 1
        ? group
        : {
            ...group,
            ...(group.atMs == null ? {} : { atMs: group.atMs * castScale }),
            ...(Array.isArray(group.ticks)
              ? {
                  ticks: group.ticks.map((tick) => ({
                    ...tick,
                    atMs: Number(tick.atMs) * castScale
                  }))
                }
              : {})
          };
    const damageGroup: Partial<MesmerStrikeEffect> = {
      ...timedGroup,
      source: 'Player'
    };
    const fixedTicks = damageGroup.ticks?.length ? damageGroup.ticks : null;
    // Emit directly; packet ownership and delivery are the contract, not a discarded timestamp list.
    const emitStrikes = (origin: number, effect: Partial<MesmerStrikeEffect>): void => {
      for (const packet of buildMesmerStrikes(state, skill, origin, effect)) {
        state.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet
        });
      }
    };

    const timingAnchorAt = damageGroup.timingAnchor === 'castStart' ? castStart : at;

    if (fixedTicks) {
      return emitStrikes(timingAnchorAt, {
        ...damageGroup,
        coefficient: undefined,
        hits: undefined,
        atMs: undefined,
        intervalMs: undefined,
        ticks: fixedTicks,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      });
    }

    return emitStrikes(timingAnchorAt, damageGroup);
  };

  const schedulePlayerConditions = (
    skill: MesmerSkill,
    at: number,
    castStart: number,
    conditions: readonly MesmerConditionEffect[],
    delivery: EffectDelivery
  ): void => {
    for (const effect of conditions) {
      const timingAnchorAt = effect.timingAnchor === 'castStart' ? castStart : at;
      buildMesmerConditions(state, skill.name, timingAnchorAt, effect, 'Player', '', { skillId: skill.id }).forEach(
        (packet) => {
          state.effects.emit({
            ...delivery,
            kind: 'packet',
            event: packet
          });
        }
      );
    }
  };

  const schedulePackets = (
    skill: MesmerSkill,
    at: number,
    castStart: number,
    playerEffectEnd: number,
    conditions: readonly MesmerConditionEffect[],
    phantasmExecutions: readonly MesmerPhantasmExecution[],
    delivery: EffectDelivery = {}
  ): void => {
    const strikeEffects = (skill.effects || []).filter(
      (effect): effect is MesmerStrikeEffect => effect.type === 'strike'
    );
    for (const group of strikeEffects) {
      if (group.summonKind === 'phantasm') {
        if (phantasmExecutions.length === 0) {
          throw new TypeError(`Phantasm strike ${skill.id} requires phantasm resource metadata.`);
        }

        for (const phantasm of phantasmExecutions) {
          schedulePhantasmStrike(state, phantasm, group, castStart);
        }

        continue;
      }

      const firstPacketMs = group.ticks?.[0]?.atMs ?? group.atMs ?? 0;
      const firstPacketScale =
        group.timingScale === 'cast' ? castRelativeEffectTimingScale(skill, Math.max(0, at - castStart) * 1000) : 1;
      const timingOrigin = group.timingAnchor === 'castStart' ? castStart : at;
      // Use the authored packet offset and anchor for both admission and emission.
      const hitAt = timingOrigin + (firstPacketMs * firstPacketScale) / 1000;

      // Uninterrupted actor work has no cutoff; interrupted player packets end at the canonical deadline.
      if (playerEffectEnd !== Infinity && canonicalTime(hitAt) > canonicalTime(playerEffectEnd)) continue;

      schedulePlayerStrike(skill, group, at, castStart, delivery);
    }

    // Keep player conditions on the cast and summon conditions on each phantasm's own lifecycle.
    const playerConditions = conditions.filter((effect) => effect.summonKind !== 'phantasm');
    const phantasmConditions = conditions.filter((effect) => effect.summonKind === 'phantasm');
    schedulePlayerConditions(skill, at, castStart, playerConditions, delivery);
    for (const phantasm of phantasmExecutions) {
      schedulePhantasmStatuses(state, phantasm, phantasmConditions);
    }
  };

  // Simultaneous conversions form one resource grant, after the batch's lifecycle and attack work.
  const scheduleConversions = (executions: readonly MesmerPhantasmExecution[]): void => {
    const groups = new Map<number, MesmerPhantasmExecution[]>();
    for (const execution of executions) {
      const group = groups.get(execution.conversionAt) || [];
      group.push(execution);
      groups.set(execution.conversionAt, group);
    }

    for (const group of groups.values()) queueConversion(group[0], group.length);
  };

  const schedule = (
    skill: MesmerSkill,
    at: number,
    castStart = at,
    {
      clarityConsumed = false,
      phantasmSummonAt = at,
      playerEffectEnd = Infinity,
      delivery = {}
    }: PhantasmScheduleOptions = {}
  ): void => {
    // Only phantasm casts reach this pipeline; ordinary pulses and hit tracking belong to the shared scheduler.
    const phantasmExecutions = prepare(skill, castStart, phantasmSummonAt, clarityConsumed, delivery);
    scheduleLifecycle(phantasmExecutions);
    const conditions = (skill.effects || []).filter(
      (effect): effect is MesmerConditionEffect => effect.type === 'condition'
    );
    schedulePackets(skill, at, castStart, playerEffectEnd, conditions, phantasmExecutions, delivery);
    // Summon declarations earn resources through their prepared phantasm conversion batches.
    scheduleConversions(phantasmExecutions);
  };

  return { schedule };
}
