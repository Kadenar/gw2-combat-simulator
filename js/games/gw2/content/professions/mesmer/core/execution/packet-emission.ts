/**
 * Owns Mesmer skill packet emission and hit-trigger bookkeeping.
 * Effect ordering lives in `effect-controller.ts`; persistent illusion behavior lives under `mechanics/illusions/`.
 */
import {
  emitFencersFinesseStacks,
  recordFencersFinesseProc
} from '#gw2/content/professions/mesmer/core/traits/index.js';
import { scheduleMesmerTrackedHits } from '#gw2/content/professions/mesmer/core/mechanics/tracked-hits.js';
import type {
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerConfig
} from '#gw2/content/professions/mesmer/types.js';
import type { SchedulerState } from '#gw2/platform/engine/types.js';
import { castRelativeEffectTimingScale } from '#gw2/platform/skills/timing.js';
import type {
  MesmerPhantasmEffectController,
  MesmerPhantasmExecution
} from '#gw2/content/professions/mesmer/core/mechanics/illusions/phantasms.js';

import type { MesmerRuntimeState } from '#gw2/content/professions/mesmer/state/types.js';
import type {
  MesmerConditionEffect,
  MesmerDamageGroup,
  MesmerSkill,
  MesmerStrikeEffect
} from '#gw2/content/professions/mesmer/data/types.js';

export interface MesmerSkillDamageResult {
  readonly firstFencerTriggerAt: number;
}

export interface MesmerSkillDamageController {
  schedule(
    skill: MesmerSkill,
    at: number,
    castStart: number,
    playerEffectEnd: number,
    pulseTimes: readonly number[],
    conditions: readonly MesmerConditionEffect[],
    phantasms: readonly MesmerPhantasmExecution[]
  ): MesmerSkillDamageResult;
  finish(skill: MesmerSkill, result: MesmerSkillDamageResult): void;
}

interface SkillDamageControllerOptions {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly config: MesmerConfig;
  readonly traits: ReadonlySet<number>;
  readonly epsilon: number;
  readonly phantasms: MesmerPhantasmEffectController;
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly addCondition: MesmerAddCondition;
  readonly addDamage: MesmerAddDamage;
}

export function createSkillDamageController({
  state,
  config,
  traits,
  epsilon,
  phantasms,
  addEvent,
  addTraitProc,
  addCondition,
  addDamage
}: SkillDamageControllerOptions): MesmerSkillDamageController {
  const fencersFinesseContext = { traits, epsilon, addEvent, addTraitProc };
  const schedulePlayerStrike = (
    skill: MesmerSkill,
    group: MesmerStrikeEffect,
    selectedGroup: MesmerDamageGroup,
    at: number,
    castStart: number
  ): readonly number[] => {
    const castScale =
      group.timingScale === 'cast' ? castRelativeEffectTimingScale(skill, Math.max(0, at - castStart) * 1000) : 1;
    // Mesmer's replacing handler materializes its own packets, so project the
    // same Quickness-authored timing that the shared scheduler would use.
    const timedGroup: MesmerDamageGroup =
      castScale === 1
        ? selectedGroup
        : {
            ...selectedGroup,
            ...(selectedGroup.atMs == null ? {} : { atMs: Number(selectedGroup.atMs) * castScale }),
            ...(Array.isArray(selectedGroup.ticks)
              ? {
                  ticks: selectedGroup.ticks.map((tick) => ({
                    ...tick,
                    atMs: Number(tick.atMs) * castScale
                  }))
                }
              : {})
          };
    const damageGroup: MesmerDamageGroup = {
      ...timedGroup,
      source: 'Player'
    };
    const fixedTicks = damageGroup.ticks?.length ? damageGroup.ticks : null;
    const emittedAt = (origin: number, effect: MesmerDamageGroup): readonly number[] =>
      addDamage(skill, origin, effect).map((event) => event.at);
    if (fixedTicks?.length) {
      const timingAnchorAt = damageGroup.timingAnchor === 'castStart' ? castStart : at;
      return emittedAt(timingAnchorAt, {
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

    if (group.castProgress != null) {
      const hitAt = group.castProgress != null ? castStart + (at - castStart) * Number(group.castProgress) : at;
      return emittedAt(hitAt, {
        ...damageGroup,
        atMs: undefined,
        intervalMs: undefined,
        timingAnchor: undefined,
        timingScale: undefined
      });
    }

    const timingAnchorAt = damageGroup.timingAnchor === 'castStart' ? castStart : at;
    return emittedAt(timingAnchorAt, damageGroup);
  };

  const schedulePlayerConditions = (
    skill: MesmerSkill,
    at: number,
    castStart: number,
    pulseTimes: readonly number[],
    conditions: readonly MesmerConditionEffect[]
  ): void => {
    for (const effect of conditions) {
      const condition = { ...effect, name: effect.condition };
      if (pulseTimes.length > 0 && Number(condition.stacks || 1) === pulseTimes.length) {
        const origin = Math.min(...pulseTimes);
        addCondition(skill.name, origin, {
          ...condition,
          stacks: undefined,
          ticks: pulseTimes.map((pulseAt) => ({
            atMs: (pulseAt - origin) * 1000,
            condition: condition.name,
            duration: condition.duration,
            stacks: 1
          })),
          timingAnchor: 'castStart',
          timingScale: 'fixed'
        });
      } else {
        const timingAnchorAt = effect.timingAnchor === 'castStart' ? castStart : at;
        addCondition(skill.name, timingAnchorAt, condition, 'Player');
      }
    }
  };

  const schedule = (
    skill: MesmerSkill,
    at: number,
    castStart: number,
    playerEffectEnd: number,
    pulseTimes: readonly number[],
    conditions: readonly MesmerConditionEffect[],
    phantasmExecutions: readonly MesmerPhantasmExecution[]
  ): MesmerSkillDamageResult => {
    const playerHitTimes: number[] = [];
    let firstFencerTriggerAt = Infinity;
    const addFencerStacks = (hitTimes: readonly number[], hits: number | undefined): void => {
      firstFencerTriggerAt = Math.min(
        firstFencerTriggerAt,
        emitFencersFinesseStacks(fencersFinesseContext, skill, hitTimes, hits)
      );
    };

    const strikeEffects = (skill.effects || []).filter(
      (effect): effect is MesmerStrikeEffect => effect.type === 'strike'
    );
    for (const group of strikeEffects) {
      if (group.requiredTrait && !traits.has(group.requiredTrait)) continue;
      const selectedGroup: MesmerDamageGroup =
        skill.boonlessCoefficient && config.target?.boonless
          ? { ...group, coefficient: skill.boonlessCoefficient }
          : group;
      if (group.summonKind === 'phantasm') {
        if (phantasmExecutions.length === 0) {
          throw new TypeError(`Phantasm strike ${skill.id} requires phantasm resource metadata.`);
        }

        for (const phantasm of phantasmExecutions) {
          const result = phantasms.scheduleStrike(phantasm, group, selectedGroup, castStart);
          const packetCount = result.damageGroup.ticks?.length ?? result.damageGroup.hits;
          addFencerStacks(result.initialHitTimes, packetCount);
          addFencerStacks(result.repeatHitTimes, packetCount);
        }

        continue;
      }

      const firstPacketMs = Number(group.ticks?.[0]?.atMs ?? group.atMs ?? 0);
      const firstPacketScale =
        group.timingScale === 'cast' ? castRelativeEffectTimingScale(skill, Math.max(0, at - castStart) * 1000) : 1;
      const timingOrigin = group.timingAnchor === 'castStart' ? castStart : at;
      const hitAt =
        group.castProgress != null
          ? castStart + (at - castStart) * Number(group.castProgress)
          : timingOrigin + (firstPacketMs * firstPacketScale) / 1000;
      if (hitAt > playerEffectEnd + epsilon) continue;
      const hitTimes = schedulePlayerStrike(skill, group, selectedGroup, at, castStart);
      if (group.actorType === 'player') {
        playerHitTimes.push(...hitTimes);
        addFencerStacks(hitTimes, selectedGroup.ticks?.length ?? selectedGroup.hits);
      }
    }

    scheduleMesmerTrackedHits(state, epsilon, addDamage, skill, playerHitTimes);
    if (phantasmExecutions.length > 0) {
      // Summon subtype, rather than actor ownership, keeps phantasm conditions out of the player path.
      const playerConditions = conditions.filter((effect) => effect.summonKind !== 'phantasm');
      const phantasmConditions = conditions.filter((effect) => effect.summonKind === 'phantasm');
      schedulePlayerConditions(skill, at, castStart, pulseTimes, playerConditions);
      for (const phantasm of phantasmExecutions) {
        phantasms.scheduleConditions(phantasm, phantasmConditions);
      }
    } else {
      schedulePlayerConditions(skill, at, castStart, pulseTimes, conditions);
    }

    return { firstFencerTriggerAt };
  };

  const finish = (skill: MesmerSkill, result: MesmerSkillDamageResult): void => {
    recordFencersFinesseProc(fencersFinesseContext, skill, result.firstFencerTriggerAt);
  };

  return { schedule, finish };
}
