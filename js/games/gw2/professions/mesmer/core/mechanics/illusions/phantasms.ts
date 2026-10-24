import { ACTOR } from '#gw2/platform/constants.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  schedulePhantasmBonusStrike,
  schedulePhantasmStatuses,
  schedulePhantasmStrike
} from '#gw2/professions/mesmer/core/mechanics/illusions/phantasm-attacks.js';
import type {
  MesmerPhantasmAttackTiming,
  MesmerPhantasmEffectController,
  MesmerPhantasmExecution,
  MesmerPhantasmPolicy,
  MesmerQueueResources
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { buildMesmerPacket, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { mesmerIllusionsGained } from '#gw2/professions/mesmer/core/mechanics/resources.js';
import { phantasmalHasteSpeed } from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
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

interface PhantasmEffectControllerOptions {
  readonly state: MesmerRuntime;
  readonly phantasmTimingFor: (skillId: number) => MesmerPhantasmAttackTiming | undefined;
  readonly phantasmPolicy: () => MesmerPhantasmPolicy;
  readonly queueResources: MesmerQueueResources;
}

/** Prepare one accepted summon batch, coordinate its lifecycle, and bind attack delivery to the same runtime. */
export function createPhantasmEffectController({
  state,
  phantasmTimingFor,
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
        actorType: ACTOR.SUMMON,
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

    if (!execution.hasRepeat || !policy.repeat) return;

    // The active specialization repeat policy re-summons the phantasm for a second attack cycle.
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
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
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
        schedulePhantasmBonusStrike(state, item, item.repeatDamageAt);
      }

      state.effects.emit({
        ...execution.delivery,
        kind: 'announcement',
        log: true,
        attribution: { source: 'Trait', sourceId: policy.bonusStrike.traitId, actorType: ACTOR.EFFECT },
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
    scheduleStrike: (execution, group, castStart) => schedulePhantasmStrike(state, execution, group, castStart),
    scheduleStatuses: (execution, conditions) => schedulePhantasmStatuses(state, execution, conditions),
    queueConversion
  };
}
