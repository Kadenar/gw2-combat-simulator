import { ACTOR } from '#gw2/platform/constants.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { MesmerPhantasmExecution } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import {
  buildMesmerConditions,
  buildMesmerPacket,
  buildMesmerStrikes,
  mesmerPacketOwner
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type { MesmerConditionEffect, MesmerStrikeEffect } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Deliver the captured trait bonus without changing its player ownership or per-entity proc identity. */
export function schedulePhantasmBonusStrike(
  state: MesmerRuntime,
  execution: MesmerPhantasmExecution,
  at: number
): void {
  const bonus = execution.policy.bonusStrike;

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
        traitId: bonus.traitId,
        // Each entity conversion is one proc, even when its strike expands into multiple damage packets.
        ...(index === 0 ? { metadata: { ...packet.metadata, procCount: 1 } } : {})
      },
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  });
}

/** Deliver initial and repeated phantasm strikes from the accepted entity policy and timing snapshot. */
export function schedulePhantasmStrike(
  state: MesmerRuntime,
  execution: MesmerPhantasmExecution,
  group: MesmerStrikeEffect,
  castStart: number
): void {
  const sourcedGroup: Partial<MesmerStrikeEffect> = {
    ...group,
    source: 'Phantasm',
    actorType: ACTOR.SUMMON,
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
  // Distinct attacks carry their own label and parent attribution in the effect declaration.
  const repeatAttackName = group.parentSkillName ? groupName : execution.skill.name;

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

    initialEvents = buildMesmerStrikes(state, execution.skill, castStart, {
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
    }).map((packet) => {
      emitAttackPacket(state, execution, packet);
      return packet;
    });
  } else if (fixedTicks?.length) {
    initialEvents = buildMesmerStrikes(state, execution.skill, castStart, {
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
    }).map((packet) => {
      emitAttackPacket(state, execution, packet);
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
      }
    ).map((packet) => {
      emitAttackPacket(state, execution, packet);
      return packet;
    });
  }

  const initialHitTimes = initialEvents.map((event) => event.at);

  if (execution.hasRepeat) {
    const repeatPolicy = execution.policy.repeat;

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
          name: `${repeatAttackName} - ${repeatPolicy.label}`,
          multiplier: repeatPolicy.damageMultiplier
        }
      ).forEach((packet) => {
        emitAttackPacket(state, execution, packet);
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
            name: `${repeatAttackName} - ${repeatPolicy.label}`,
            multiplier: repeatPolicy.damageMultiplier
          }
        ).forEach((packet) => {
          emitAttackPacket(state, execution, packet);
        });
      }
    }
  }
}

/** Deliver phantasm controls and conditions with their attack cycles and entity-specific ownership. */
export function schedulePhantasmStatuses(
  state: MesmerRuntime,
  execution: MesmerPhantasmExecution,
  conditions: readonly MesmerConditionEffect[]
): void {
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
          actorType: ACTOR.SUMMON,
          summonKind: 'phantasm'
        }
      })) {
        const packet = buildMesmerPacket({ ...application.event, summonKind: 'phantasm' });
        emitAttackPacket(state, execution, packet);
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
    actorType: ACTOR.SUMMON,
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
        emitAttackPacket(state, execution, packet);
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
        emitAttackPacket(state, execution, packet);
      });
    }
  }

  if (!execution.hasRepeat || entityConditions.length === 0) return;

  const repeatPolicy = execution.policy.repeat;

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
        emitAttackPacket(state, execution, packet);
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
        emitAttackPacket(state, execution, packet);
      });
    }
  }
}

/** Every attack packet retains the accepted delivery, actor ownership, and authored scheduling priority. */
function emitAttackPacket(state: MesmerRuntime, execution: MesmerPhantasmExecution, packet: SimulationEventBase): void {
  state.effects.emit({
    ...execution.delivery,
    kind: 'packet',
    event: packet,
    owner: mesmerPacketOwner(packet),
    priority: Number(packet.priority ?? 0)
  });
}
