import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import {
  buildMesmerStrikes,
  mesmerPacketOwner,
  buildMesmerPacket,
  buildMesmerConditions
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import { phantasmalHasteSpeed, triggerCompoundingPower } from '#gw2/professions/mesmer/core/traits/illusions.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

import type {
  MesmerPhantasmAttackTiming,
  MesmerPhantasmPolicy,
  MesmerQueueResources
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerConditionEffect, MesmerSkill, MesmerStrikeEffect } from '#gw2/professions/mesmer/data/types.js';

export interface MesmerPhantasmExecution {
  readonly delivery: EffectDelivery;
  readonly skill: MesmerSkill;
  // Index among co-spawned entities (e.g. Bountiful Blades spawns 2 Berserkers: 0 and 1).
  readonly entityIndex: number;
  // Scales coefficient down when multiple phantasms share a skill's total damage budget (Bountiful Blades: 0.66).
  readonly damageMultiplier: number;
  readonly summonAt: number;
  readonly damageAt: number;
  // When a specialization repeat policy re-summons the phantasm; equals damageAt otherwise.
  readonly spawnAt: number;
  // Timestamp for the optional repeat attack.
  readonly repeatDamageAt: number;
  // When the phantasm converts to a blade/resource. Equals spawnAt normally;
  // equals the specialization-authored re-spawn time when repeat is active.
  readonly conversionAt: number;
  // When a specialization bonus strike fires; uses a post-spawn delay when supplied.
  readonly initialBladeAt: number;
  readonly hasRepeat: boolean;
  // Optional specialization policy override for the generic conversion timestamp.
  readonly resourceAtOverride: number | null;
  readonly timing: MesmerPhantasmAttackTiming;
  // Converts a raw post-cast millisecond offset from timing metadata into a simulation
  // timestamp, accounting for cast duration and Phantasmal Haste speed scaling.
  readonly endpoint: (atMs: number | undefined) => number;
}

export interface MesmerPhantasmEffectController {
  prepare(
    skill: MesmerSkill,
    castStart: number,
    summonAt: number,
    clarityConsumed: boolean,
    delivery?: EffectDelivery
  ): readonly MesmerPhantasmExecution[];
  scheduleLifecycle(executions: readonly MesmerPhantasmExecution[]): void;
  scheduleStrike(execution: MesmerPhantasmExecution, group: MesmerStrikeEffect, castStart: number): void;
  scheduleStatuses(execution: MesmerPhantasmExecution, conditions: readonly MesmerConditionEffect[]): void;
  queueConversion(execution: MesmerPhantasmExecution, amount?: number): void;
}

interface PhantasmEffectControllerOptions {
  readonly state: MesmerRuntime;
  readonly phantasmAttackTimings: Readonly<Record<number, MesmerPhantasmAttackTiming>>;
  readonly phantasmPolicy: () => MesmerPhantasmPolicy;
  readonly queueResources: MesmerQueueResources;
}

export function createPhantasmEffectController({
  state,
  phantasmAttackTimings,
  phantasmPolicy,
  queueResources
}: PhantasmEffectControllerOptions): MesmerPhantasmEffectController {
  const prepare = (
    skill: MesmerSkill,
    castStart: number,
    summonAt: number,
    clarityConsumed: boolean,
    delivery: EffectDelivery = {}
  ): readonly MesmerPhantasmExecution[] => {
    if (skill.resource?.mode !== 'phantasm') return [];

    // Skill-owned summon counts use the accepted Clarity snapshot before trait spawn policies.
    const policy = phantasmPolicy();
    const spawnModifier = policy.spawnModifiers[skill.id];
    const count =
      (clarityConsumed ? (skill.resource.clarityCount ?? skill.resource.count ?? 1) : (skill.resource.count ?? 1)) *
      (spawnModifier?.countMultiplier ?? 1);

    const timing = phantasmAttackTimings[skill.id];
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
        delivery,
        skill,
        entityIndex,
        damageMultiplier: spawnModifier?.damageMultiplier ?? 1,
        summonAt,
        damageAt,
        spawnAt,
        repeatDamageAt,
        // A repeat policy defers conversion until the specialization-authored re-spawn timestamp.
        conversionAt: hasRepeat
          ? endpoint(timing.repeatSpawnAtMsByEntity?.[entityIndex] ?? timing.repeatSpawnAtMs)
          : spawnAt,
        initialBladeAt:
          timing.phantasmalBladeDelayAfterSpawnMs != null
            ? spawnAt + timing.phantasmalBladeDelayAfterSpawnMs / 1000
            : damageAt,
        hasRepeat,
        resourceAtOverride:
          policy.conversionTiming === 'blade-tick' && !hasRepeat && conversionTick
            ? endpoint(conversionTick.atMs)
            : null,
        timing,
        endpoint
      };
    });
  };

  const addBonusStrike = (execution: MesmerPhantasmExecution, at: number): void => {
    const bonus = phantasmPolicy().bonusStrike;
    if (!bonus) return;
    buildMesmerStrikes(
      state,
      {
        id: bonus.name,
        name: bonus.name,
        weapon: execution.skill.weapon,
        blade: true
      },
      at,
      {
        ...bonus.damage,
        summonKind: undefined,
        source: 'Player',
        weaponStrength: bonus.damage.weaponStrength
      }
    ).forEach((packet, index) => {
      state.effects.emit({
        ...execution.delivery,
        kind: 'packet',
        // Name the trait owner without changing the blade's combat source, skill identity, or player scaling.
        event: {
          ...packet,
          name: bonus.traitName,
          procType: 'trait',
          // Each entity conversion is one proc, even when its strike expands into multiple damage packets.
          ...(index === 0 ? { metadata: { ...packet.metadata, procCount: 1 } } : {})
        },
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });
  };

  const scheduleLifecycle = (executions: readonly MesmerPhantasmExecution[]): void => {
    const execution = executions[0];
    if (!execution) return;
    const { skill } = execution;
    const count = executions.length;
    const policy = phantasmPolicy();

    // Lifecycle events use the latest entity's timestamp so the "complete" marker
    // fires after every entity in the batch has finished attacking. They retain explicit phantasm ownership.
    const damageAt = Math.max(...executions.map((item) => item.damageAt));
    const repeatDamageAt = Math.max(...executions.map((item) => item.repeatDamageAt));
    const initialBladeAt = Math.max(...executions.map((item) => item.initialBladeAt));

    triggerCompoundingPower(
      state,
      execution.summonAt,
      count,
      skill.name,
      `${count} phantasm${count === 1 ? '' : 's'}`,
      execution.delivery
    );

    {
      const packet = buildMesmerPacket({
        type: 'mesmer.phantasm-summoned',
        actorType: 'summon',
        summonKind: 'phantasm',
        at: execution.summonAt,
        name: skill.name,
        count,
        // Expose each scheduled resource deadline, including staggered Chronophantasma conversions, for cursor inspection.
        conversionTimes: executions.map((item) => canonicalTime(item.resourceAtOverride ?? item.conversionAt))
      });
      state.effects.emit({
        ...execution.delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    }

    {
      const packet = buildMesmerPacket({
        type: 'mesmer.phantasm-attack',
        actorType: 'summon',
        summonKind: 'phantasm',
        at: damageAt,
        name: skill.name,
        count,
        repeat: false,
        complete: true
      });
      state.effects.emit({
        ...execution.delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    }

    if (policy.bonusStrike) {
      // Each entity fires its specialization-defined bonus strike at its own initial timestamp.
      for (const item of executions) {
        addBonusStrike(item, item.initialBladeAt);
      }

      state.effects.emit({
        ...execution.delivery,
        kind: 'announcement',
        log: true,
        attribution: { source: 'Trait', sourceId: policy.bonusStrike.traitId, actorType: 'effect' },
        announcement: {
          type: 'trait',
          name: policy.bonusStrike.traitName,
          at: initialBladeAt,
          sourceSkill: skill.name,
          detail: ''
        }
      });
    }

    if (!execution.hasRepeat || !policy.repeat) return;

    // The active specialization repeat policy re-summons the phantasm for a second attack cycle.
    triggerCompoundingPower(
      state,
      execution.spawnAt,
      count,
      `${skill.name} - ${policy.repeat.label}`,
      `${count} phantasm${count === 1 ? '' : 's'}`,
      execution.delivery
    );

    {
      const packet = buildMesmerPacket({
        type: 'mesmer.phantasm-resummoned',
        actorType: 'summon',
        summonKind: 'phantasm',
        at: execution.spawnAt,
        name: skill.name,
        count
      });
      state.effects.emit({
        ...execution.delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    }

    {
      const packet = buildMesmerPacket({
        type: 'mesmer.phantasm-attack',
        actorType: 'summon',
        summonKind: 'phantasm',
        at: repeatDamageAt,
        name: skill.name,
        count,
        repeat: true,
        complete: true
      });
      state.effects.emit({
        ...execution.delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    }

    if (policy.bonusStrike) {
      for (const item of executions) {
        addBonusStrike(item, item.repeatDamageAt);
      }

      state.effects.emit({
        ...execution.delivery,
        kind: 'announcement',
        log: true,
        attribution: { source: 'Trait', sourceId: policy.bonusStrike.traitId, actorType: 'effect' },
        announcement: {
          type: 'trait',
          name: policy.bonusStrike.traitName,
          at: repeatDamageAt,
          sourceSkill: `${skill.name} - ${policy.repeat.label}`,
          detail: ''
        }
      });
    }

    state.effects.emit({
      ...execution.delivery,
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: policy.repeat.traitId, actorType: 'effect' },
      announcement: {
        type: 'trait',
        name: policy.repeat.traitName,
        at: execution.spawnAt,
        sourceSkill: skill.name,
        detail: ''
      }
    });
  };

  const scheduleStrike = (execution: MesmerPhantasmExecution, group: MesmerStrikeEffect, castStart: number): void => {
    const sourcedGroup: Partial<MesmerStrikeEffect> = {
      ...group,
      source: 'Phantasm',
      actorType: 'summon',
      summonKind: 'phantasm'
    };
    const baseTicks = sourcedGroup.ticks?.length ? sourcedGroup.ticks : null;
    const damageGroup: Partial<MesmerStrikeEffect> = {
      ...sourcedGroup,
      ...(baseTicks
        ? {
            coefficient: undefined,
            hits: undefined,
            ticks: baseTicks.map((tick) => ({
              ...tick,
              coefficient: tick.coefficient * execution.damageMultiplier
            }))
          }
        : { coefficient: (sourcedGroup.coefficient || 0) * execution.damageMultiplier })
    };
    const groupName = group.name || '';
    const attackDisplayName = execution.skill.phantasmDisplayNames?.[groupName] ?? '';
    const initialEventExtra = attackDisplayName
      ? {
          name: attackDisplayName,
          parentSkillName: execution.skill.name
        }
      : undefined;

    // Measured phantasm timings position the authored damage packets without changing their formulas.
    const measuredTicks =
      execution.timing.damageTicksByEntity?.[execution.entityIndex]?.[groupName] ??
      (Array.isArray(execution.timing.damageTicks?.[groupName]) ? execution.timing.damageTicks[groupName] : null);
    const fixedTicks = damageGroup.ticks?.length ? damageGroup.ticks : null;
    let initialEvents: readonly SimulationEventBase[];

    if (measuredTicks?.length) {
      const coefficients = fixedTicks?.map((tick) => tick.coefficient) ?? [damageGroup.coefficient || 0];
      if (measuredTicks.length !== coefficients.length) {
        throw new TypeError(
          `Phantasm strike ${execution.skill.id} packet count does not match its measured timing metadata.`
        );
      }

      initialEvents = buildMesmerStrikes(
        state,
        execution.skill,
        castStart,
        {
          ...damageGroup,
          coefficient: undefined,
          hits: undefined,
          atMs: undefined,
          intervalMs: undefined,
          ticks: measuredTicks.map((packet, index) => ({
            atMs: (execution.endpoint(packet.atMs) - castStart) * 1000,
            coefficient: coefficients[index]
          })),
          timingAnchor: 'castStart',
          timingScale: 'fixed'
        },
        initialEventExtra
      ).map((packet) => {
        state.effects.emit({
          ...execution.delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
        return packet;
      });
    } else if (fixedTicks?.length) {
      initialEvents = buildMesmerStrikes(
        state,
        execution.skill,
        castStart,
        {
          ...damageGroup,
          atMs: undefined,
          intervalMs: undefined,
          // Skill-owned phantasm packets use measured post-cast offsets and still inherit Phantasmal Haste.
          ticks: fixedTicks.map((tick) => ({
            ...tick,
            atMs: (execution.endpoint(tick.atMs) - castStart) * 1000
          })),
          timingAnchor: 'castStart',
          timingScale: 'fixed'
        },
        initialEventExtra
      ).map((packet) => {
        state.effects.emit({
          ...execution.delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
        return packet;
      });
    } else {
      initialEvents = buildMesmerStrikes(
        state,
        execution.skill,
        damageGroup.atMs == null ? execution.damageAt : execution.endpoint(damageGroup.atMs),
        {
          ...damageGroup,
          atMs: undefined,
          intervalMs: undefined,
          timingAnchor: undefined,
          timingScale: undefined
        },
        initialEventExtra
      ).map((packet) => {
        state.effects.emit({
          ...execution.delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
        return packet;
      });
    }

    const initialHitTimes = initialEvents.map((event) => event.at);
    if (execution.hasRepeat) {
      const repeatPolicy = phantasmPolicy().repeat;
      if (!repeatPolicy) return;
      // Prefer dedicated repeat tick data; fall back to shifting the initial
      // hit pattern by the delta between repeatDamageAt and damageAt.
      const repeatMeasuredTicks =
        execution.timing.repeatDamageTicksByEntity?.[execution.entityIndex]?.[groupName] ??
        execution.timing.repeatDamageTicks?.[groupName] ??
        null;
      if (repeatMeasuredTicks?.length) {
        const coefficients = fixedTicks?.map((tick) => tick.coefficient) ?? [damageGroup.coefficient || 0];
        if (repeatMeasuredTicks.length !== coefficients.length) {
          throw new TypeError(
            `Phantasm strike ${execution.skill.id} packet count does not match its measured repeat timing metadata.`
          );
        }

        buildMesmerStrikes(
          state,
          execution.skill,
          castStart,
          {
            ...damageGroup,
            coefficient: undefined,
            hits: undefined,
            atMs: undefined,
            intervalMs: undefined,
            ticks: repeatMeasuredTicks.map((packet, index) => ({
              atMs: (execution.endpoint(packet.atMs) - castStart) * 1000,
              coefficient: coefficients[index]
            })),
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          },
          {
            name: `${attackDisplayName || execution.skill.name} - ${repeatPolicy.label}`,
            ...(attackDisplayName ? { parentSkillName: execution.skill.name } : {}),
            multiplier: repeatPolicy.damageMultiplier
          }
        ).forEach((packet) => {
          state.effects.emit({
            ...execution.delivery,
            kind: 'packet',
            event: packet,
            owner: mesmerPacketOwner(packet),
            priority: Number(packet.priority ?? 0)
          });
        });
      } else {
        // No dedicated repeat ticks — shift each initial hit forward by the same offset.
        const repeatOffset = execution.repeatDamageAt - execution.damageAt;
        const shiftedHitTimes = initialHitTimes.map((hitAt) => hitAt + repeatOffset);
        if (shiftedHitTimes.length > 0) {
          const repeatOrigin = Math.min(...shiftedHitTimes);
          buildMesmerStrikes(
            state,
            execution.skill,
            repeatOrigin,
            {
              ...damageGroup,
              coefficient: undefined,
              hits: undefined,
              atMs: undefined,
              intervalMs: undefined,
              ticks: initialEvents.map((event, index) => ({
                atMs: (shiftedHitTimes[index] - repeatOrigin) * 1000,
                coefficient: Number(event.coefficient || 0)
              })),
              timingAnchor: 'castStart',
              timingScale: 'fixed'
            },
            {
              name: `${attackDisplayName || execution.skill.name} - ${repeatPolicy.label}`,
              ...(attackDisplayName ? { parentSkillName: execution.skill.name } : {}),
              multiplier: repeatPolicy.damageMultiplier
            }
          ).forEach((packet) => {
            state.effects.emit({
              ...execution.delivery,
              kind: 'packet',
              event: packet,
              owner: mesmerPacketOwner(packet),
              priority: Number(packet.priority ?? 0)
            });
          });
        }
      }
    }
  };

  const scheduleStatuses = (execution: MesmerPhantasmExecution, conditions: readonly MesmerConditionEffect[]): void => {
    // Summon controls follow each actual attack cycle, including a committed Chronophantasma repeat.
    for (const effect of execution.skill.effects || []) {
      if (effect.type !== 'control' || effect.summonKind !== 'phantasm') continue;
      for (const impactAt of execution.hasRepeat
        ? [execution.damageAt, execution.repeatDamageAt]
        : [execution.damageAt]) {
        for (const application of materializeSkillEffectApplications({
          skill: execution.skill,
          effect,
          start: impactAt,
          fullEnd: impactAt,
          baseEvent: {
            source: 'Phantasm',
            sourceId: execution.skill.id,
            skillId: execution.skill.id,
            skillName: execution.skill.name,
            actorType: 'summon',
            summonKind: 'phantasm'
          }
        })) {
          const packet = buildMesmerPacket({ ...application.event, summonKind: 'phantasm' });
          state.effects.emit({
            ...execution.delivery,
            kind: 'packet',
            event: packet,
            owner: mesmerPacketOwner(packet),
            priority: Number(packet.priority ?? 0)
          });
        }
      }
    }

    // Conditions with a phantasmEntityIndex only apply to that specific entity
    // (e.g. only the first Berserker applies vulnerability on its leap).
    const entityConditions = conditions.filter(
      (effect) => effect.phantasmEntityIndex == null || effect.phantasmEntityIndex === execution.entityIndex
    );
    const conditionEventExtra = {
      source: 'Phantasm',
      sourceId: execution.skill.id,
      skillId: execution.skill.id,
      actorType: 'summon' as const,
      summonKind: 'phantasm' as const
    };
    const authoredDamageTicks = (label: string) =>
      execution.skill.effects?.find(
        (candidate): candidate is MesmerStrikeEffect => candidate.type === 'strike' && candidate.name === label
      )?.ticks;
    for (const effect of entityConditions) {
      const condition = effect;
      // packetLabel ties the condition's application times to a named damage-tick sequence,
      // so conditions that apply on each hit are synchronized with the actual hit packets.
      const authoredTicks = condition.packetLabel ? authoredDamageTicks(condition.packetLabel) : null;
      const conditionTicks = condition.packetLabel
        ? (execution.timing.damageTicksByEntity?.[execution.entityIndex]?.[condition.packetLabel] ??
          execution.timing.damageTicks?.[condition.packetLabel] ??
          authoredTicks ??
          null)
        : null;
      if (conditionTicks && conditionTicks.length > 0) {
        // Split stacks evenly across application packets.
        const packetStacks = (condition.stacks ?? 1) / conditionTicks.length;
        const applicationTimes = conditionTicks.map((tick) => execution.endpoint(tick.atMs));
        const conditionOrigin = Math.min(...applicationTimes);
        buildMesmerConditions(
          state,
          execution.skill.name,
          conditionOrigin,
          {
            ...condition,
            stacks: undefined,
            ticks: applicationTimes.map((applicationAt) => ({
              atMs: (applicationAt - conditionOrigin) * 1000,
              condition: condition.condition,
              duration: condition.duration,
              stacks: packetStacks
            })),
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          },
          'Phantasm',
          '',
          conditionEventExtra
        ).forEach((packet) => {
          state.effects.emit({
            ...execution.delivery,
            kind: 'packet',
            event: packet,
            owner: mesmerPacketOwner(packet),
            priority: Number(packet.priority ?? 0)
          });
        });
      } else {
        buildMesmerConditions(
          state,
          execution.skill.name,
          execution.damageAt,
          condition,
          'Phantasm',
          '',
          conditionEventExtra
        ).forEach((packet) => {
          state.effects.emit({
            ...execution.delivery,
            kind: 'packet',
            event: packet,
            owner: mesmerPacketOwner(packet),
            priority: Number(packet.priority ?? 0)
          });
        });
      }
    }

    if (!execution.hasRepeat || entityConditions.length === 0) return;
    const repeatPolicy = phantasmPolicy().repeat;
    if (!repeatPolicy) return;

    // Repeat cycle: prefer dedicated repeat tick data; fall back to shifting
    // initial tick timestamps by the delta between the two damage windows.
    const repeatOffset = execution.repeatDamageAt - execution.damageAt;
    for (const effect of entityConditions) {
      const condition = effect;
      const initialConditionTicks = condition.packetLabel
        ? (execution.timing.damageTicksByEntity?.[execution.entityIndex]?.[condition.packetLabel] ??
          execution.timing.damageTicks?.[condition.packetLabel] ??
          authoredDamageTicks(condition.packetLabel) ??
          null)
        : null;
      const repeatConditionTicks = condition.packetLabel
        ? (execution.timing.repeatDamageTicksByEntity?.[execution.entityIndex]?.[condition.packetLabel] ??
          execution.timing.repeatDamageTicks?.[condition.packetLabel] ??
          null)
        : null;
      // Use repeat-specific ticks if available; otherwise fall back to shifted initial ticks.
      const conditionTicks = repeatConditionTicks ?? initialConditionTicks;
      if (conditionTicks && conditionTicks.length > 0) {
        const packetStacks = (condition.stacks ?? 1) / conditionTicks.length;
        const applicationTimes = conditionTicks.map((tick) =>
          repeatConditionTicks ? execution.endpoint(tick.atMs) : execution.endpoint(tick.atMs) + repeatOffset
        );
        const conditionOrigin = Math.min(...applicationTimes);
        buildMesmerConditions(
          state,
          execution.skill.name,
          conditionOrigin,
          {
            ...condition,
            stacks: undefined,
            ticks: applicationTimes.map((applicationAt) => ({
              atMs: (applicationAt - conditionOrigin) * 1000,
              condition: condition.condition,
              duration: condition.duration,
              stacks: packetStacks
            })),
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          },
          'Phantasm',
          `${execution.skill.name} - ${repeatPolicy.label}`,
          conditionEventExtra
        ).forEach((packet) => {
          state.effects.emit({
            ...execution.delivery,
            kind: 'packet',
            event: packet,
            owner: mesmerPacketOwner(packet),
            priority: Number(packet.priority ?? 0)
          });
        });
      } else {
        buildMesmerConditions(
          state,
          execution.skill.name,
          execution.repeatDamageAt,
          condition,
          'Phantasm',
          `${execution.skill.name} - ${repeatPolicy.label}`,
          conditionEventExtra
        ).forEach((packet) => {
          state.effects.emit({
            ...execution.delivery,
            kind: 'packet',
            event: packet,
            owner: mesmerPacketOwner(packet),
            priority: Number(packet.priority ?? 0)
          });
        });
      }
    }
  };

  const queueConversion = (execution: MesmerPhantasmExecution, amount = 1): void => {
    // Resource tasks use their real conversion time; task priority keeps them after same-time illusion work.
    if (execution.resourceAtOverride != null) {
      // An active specialization may align conversion to a measured per-phantasm tick.
      queueResources(
        execution.resourceAtOverride,
        amount,
        null,
        `${execution.skill.name} phantasm conversion`,
        {
          kind: 'phantasm-conversion',
          sourceSkillId: execution.skill.id
        },
        execution.delivery
      );
      return;
    }

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

  return {
    prepare,
    scheduleLifecycle,
    scheduleStrike,
    scheduleStatuses,
    queueConversion
  };
}
