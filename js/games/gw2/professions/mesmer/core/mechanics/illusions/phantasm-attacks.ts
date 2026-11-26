import { ACTOR, COMBO_FINISHER } from '#gw2/platform/constants.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { phantasmAttackCycle } from '#gw2/professions/mesmer/core/mechanics/illusions/phantasm-attack-cycle.js';
import type { MesmerPhantasmExecution } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import {
  buildMesmerConditions,
  buildMesmerPacket,
  buildMesmerStrikes
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { scheduleWardenWhirl } from '#gw2/professions/mesmer/core/mechanics/warden.js';
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

  // One entity conversion owns all expanded strike packets.
  state.effects.emit({
    ...execution.delivery,
    kind: 'profile',
    proc: true,
    profile: { id: bonus.name, name: bonus.name, weapon: execution.skill.weapon },
    effects: [{ ...bonus.damage, type: 'strike', summonKind: undefined, source: 'Player' }],
    at,
    attribution: {
      source: 'Player',
      sourceId: bonus.name,
      skillId: bonus.name,
      skillName: bonus.name,
      actorType: ACTOR.PLAYER,
      metadata: { blade: true }
    },
    transform: (packet) => ({
      ...packet,
      name: bonus.traitName,
      procType: 'trait',
      traitId: bonus.traitId,
      skillWeapon: execution.skill.weapon
    })
  });
}

/** Deliver initial and repeated phantasm strikes from the accepted entity policy and timing snapshot. */
export function schedulePhantasmStrike(
  state: MesmerRuntime,
  execution: MesmerPhantasmExecution,
  group: MesmerStrikeEffect,
  castStart: number
): void {
  // The spawn policy's captured damage factor is applied by its trait, leaving authored coefficients intact.
  const damageGroup: Partial<MesmerStrikeEffect> = {
    ...group,
    source: 'Phantasm',
    actorType: ACTOR.SUMMON,
    summonKind: 'phantasm'
  };
  const groupName = group.name || '';
  // Distinct attacks carry their own label and parent attribution in the effect declaration.
  const repeatAttackName = group.parentSkillName ? groupName : execution.skill.name;

  // Measured phantasm timings position the authored damage packets without changing their formulas.
  const cycle = phantasmAttackCycle(execution.skill, execution.timing, execution.entityIndex, group);
  const fixedTicks = group.ticks;
  let initialEvents: readonly SimulationEventBase[];

  if (cycle.initial?.length) {
    const coefficients = fixedTicks?.length ? fixedTicks.map((tick) => tick.coefficient) : [group.coefficient || 0];

    if (cycle.initial.length !== coefficients.length) {
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
      ticks: cycle.initial.map((tick, index) => ({
        ...tick,
        atMs: (execution.endpoint(tick.atMs) - castStart) * 1000,
        coefficient: coefficients[index]
      })),
      timingAnchor: 'castStart',
      timingScale: 'fixed'
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
    );
  }

  for (const packet of initialEvents) emitAttackPacket(state, execution, packet);

  const initialHitTimes = initialEvents.map((event) => event.at);

  const repeatPolicy = execution.policy.repeat;

  if (repeatPolicy) {
    // Prefer dedicated repeat tick data; fall back to shifting the initial
    // hit pattern by the delta between repeatDamageAt and damageAt.
    const repeatMeasuredTicks = cycle.repeat;

    if (repeatMeasuredTicks?.length) {
      const coefficients = fixedTicks?.length ? fixedTicks.map((tick) => tick.coefficient) : [group.coefficient || 0];

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
          metadata: {
            chronophantasmaDamageFactor: repeatPolicy.damageMultiplier,
            chronophantasmaConditionDurationFactor: repeatPolicy.conditionDurationMultiplier
          }
        }
      ).forEach((packet) => {
        emitAttackPacket(state, execution, packet, 'repeat');
      });
    } else {
      // Without dedicated repeat ticks, shift each initial hit forward by the same offset.
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
            metadata: {
              chronophantasmaDamageFactor: repeatPolicy.damageMultiplier,
              chronophantasmaConditionDurationFactor: repeatPolicy.conditionDurationMultiplier
            }
          }
        ).forEach((packet) => {
          emitAttackPacket(state, execution, packet, 'repeat');
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
  const groups = entityConditions.map((condition) => ({
    condition,
    cycle: condition.packetLabel
      ? phantasmAttackCycle(execution.skill, execution.timing, execution.entityIndex, condition.packetLabel)
      : undefined
  }));

  const scheduleCycle = (repeat?: NonNullable<typeof execution.policy.repeat>) => {
    const impactAt = repeat ? execution.repeatDamageAt : execution.damageAt;
    for (const { condition, cycle } of groups) {
      const repeatTicks = repeat && cycle?.repeat;
      const ticks = repeatTicks ?? cycle?.initial;
      let origin = impactAt;
      let effect = condition;

      if (ticks?.length) {
        // A repeat without dedicated packets replays the initial pattern relative to its own impact.
        const offset = repeat && !repeatTicks ? impactAt - execution.damageAt : 0;
        const times = ticks.map((tick) => execution.endpoint(tick.atMs) + offset);
        origin = Math.min(...times);
        effect = {
          ...condition,
          stacks: undefined,
          ticks: times.map((at) => ({
            atMs: (at - origin) * 1000,
            condition: condition.condition,
            duration: condition.duration,
            stacks: (condition.stacks ?? 1) / ticks.length
          })),
          timingAnchor: 'castStart',
          timingScale: 'fixed'
        };
      }

      const packets = buildMesmerConditions(
        state,
        execution.skill.name,
        origin,
        effect,
        'Phantasm',
        repeat ? `${execution.skill.name} - ${repeat.label}` : '',
        conditionEventExtra
      );
      for (const packet of packets) {
        emitAttackPacket(
          state,
          execution,
          repeat ? { ...packet, duration: Number(packet.duration) * repeat.conditionDurationMultiplier } : packet
        );
      }
    }

    // A disable in this cycle can trigger effects that read the conditions it just applied.
    schedulePhantasmControls(state, execution, impactAt);
  };

  scheduleCycle();

  if (execution.policy.repeat) scheduleCycle(execution.policy.repeat);
}

/** Each attack cycle disables after its conditions, retaining the phantasm's ownership and committed delivery. */
function schedulePhantasmControls(state: MesmerRuntime, execution: MesmerPhantasmExecution, impactAt: number): void {
  for (const effect of execution.skill.effects || []) {
    if (effect.type !== 'control' || effect.summonKind !== 'phantasm') continue;

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

/** Every attack packet retains the accepted delivery, actor ownership, and authored scheduling priority. */
function emitAttackPacket(
  state: MesmerRuntime,
  execution: MesmerPhantasmExecution,
  packet: SimulationEventBase,
  cycle: 'initial' | 'repeat' = 'initial'
): void {
  scheduleWardenWhirl(state, execution, packet, cycle);
  // Each summoned whirl pulse gets its own attempt, including co-summoned entities and repeated attacks.
  const comboFinishers = packet.comboFinishers?.map((finisher) =>
    finisher.finisherType === COMBO_FINISHER.WHIRL
      ? {
          ...finisher,
          attemptGroup: JSON.stringify([finisher.attemptGroup, execution.entityIndex, cycle, packet.hitIndex])
        }
      : finisher
  );
  state.effects.emit({
    ...execution.delivery,
    kind: 'packet',
    event:
      packet.type === 'damage'
        ? {
            ...packet,
            comboFinishers,
            metadata: { ...packet.metadata, bountifulBladesDamageFactor: execution.damageMultiplier }
          }
        : packet
  });
}
