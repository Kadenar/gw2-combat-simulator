import { professionCoreState } from '../../../platform/engine/profession.js';
import { MESMER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import type {
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerConditionEffect,
  MesmerConfig,
  MesmerDamageGroup,
  MesmerRuntimeState,
  MesmerSkill,
  MesmerStrikeEffect
} from '../types.js';
import type { SchedulerState } from '../../../platform/engine/types.js';
import type { MesmerPhantasmEffectController, MesmerPhantasmExecution } from './phantasms.js';

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
  const schedulePlayerStrike = (
    skill: MesmerSkill,
    group: MesmerStrikeEffect,
    selectedGroup: MesmerDamageGroup,
    at: number,
    castStart: number,
    pulseTimes: readonly number[]
  ): readonly number[] => {
    const damageGroup: MesmerDamageGroup = {
      ...selectedGroup,
      source: 'Player'
    };
    const fixedTicks = group.ticks?.length ? group.ticks : null;
    const interval = Number(group.intervalMs || 0);
    const emittedAt = (origin: number, effect: MesmerDamageGroup): readonly number[] =>
      addDamage(skill, origin, effect).map((event) => event.at);
    if (fixedTicks?.length) {
      const hits = Math.max(1, Math.trunc(Number(damageGroup.hits || fixedTicks.length || 1)));
      const timingAnchorAt = group.timingAnchor === 'castStart' ? castStart : at;
      const ticks = Array.from({ length: hits }, (_, index) => {
        const packet = fixedTicks[index % fixedTicks.length];
        return {
          ...packet,
          coefficient: Number(packet.coefficient)
        };
      });
      return emittedAt(timingAnchorAt, {
        ...damageGroup,
        coefficient: undefined,
        hits: undefined,
        atMs: undefined,
        intervalMs: undefined,
        ticks,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      });
    }
    if (interval > 0 && Number(damageGroup.hits || 1) > 1) {
      const timingAnchorAt = group.timingAnchor === 'castStart' ? castStart : at;
      return emittedAt(timingAnchorAt, damageGroup);
    }
    if (pulseTimes.length > 0 && Number(damageGroup.hits || 1) === pulseTimes.length) {
      const origin = Math.min(...pulseTimes);
      const coefficient = Number(damageGroup.coefficient || 0) / pulseTimes.length;
      return emittedAt(origin, {
        ...damageGroup,
        coefficient: undefined,
        hits: undefined,
        atMs: undefined,
        intervalMs: undefined,
        ticks: pulseTimes.map((pulseAt) => ({
          atMs: (pulseAt - origin) * 1000,
          coefficient
        })),
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
    const timingAnchorAt = group.timingAnchor === 'castStart' ? castStart : at;
    return emittedAt(timingAnchorAt, damageGroup);
  };

  const scheduleTrackedHits = (skill: MesmerSkill, playerHitTimes: readonly number[]): void => {
    if (!skill.trackedHitDamage) return;
    const tracking = skill.trackedHitDamage;
    const duration = Number(tracking.duration || 0);
    let recentHits = [...(professionCoreState(state).trackedSkillHits[skill.id] || [])];
    const required = Math.max(1, Math.trunc(Number(tracking.hitsRequired || 1)));
    for (const currentHitAt of [...playerHitTimes].sort((a, b) => a - b)) {
      const minimum = currentHitAt - duration;
      recentHits = recentHits.filter((hitAt) => hitAt > minimum + epsilon);
      recentHits.push(currentHitAt);
      while (recentHits.length >= required) {
        const triggerHits = recentHits.splice(0, required);
        const triggerAt = triggerHits[triggerHits.length - 1];
        const hasTicks = Array.isArray(tracking.ticks) && tracking.ticks.length > 0;
        addDamage(
          skill,
          triggerAt,
          {
            ...tracking,
            ...(hasTicks
              ? {
                  coefficient: undefined,
                  hits: undefined,
                  timingAnchor: 'castStart' as const,
                  timingScale: 'fixed' as const
                }
              : {})
          },
          {
            blade: skill.blade,
            name: tracking.name,
            skillName: tracking.name,
            parentSkillName: skill.name,
            sourceId: tracking.skillId ?? skill.id,
            skillId: tracking.skillId ?? skill.id
          }
        );
      }
    }
    professionCoreState(state).trackedSkillHits[skill.id] = recentHits;
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
      if (!traits.has(TRAIT.FENCERS_FINESSE) || skill.weapon !== 'Sword' || hitTimes.length === 0) {
        return;
      }
      const hitCount = Math.max(1, Math.trunc(Number(hits || 1)));
      if (hitTimes.length === hitCount) {
        for (const hitAt of hitTimes) {
          addEvent({
            type: 'buff',
            at: hitAt + epsilon,
            kind: 'fencer',
            stacks: 1,
            duration: 6
          });
          firstFencerTriggerAt = Math.min(firstFencerTriggerAt, hitAt + epsilon);
        }
        return;
      }
      addEvent({
        type: 'buff',
        at: hitTimes[0] + epsilon,
        kind: 'fencer',
        stacks: Math.min(10, hitCount),
        duration: 6
      });
      firstFencerTriggerAt = Math.min(firstFencerTriggerAt, hitTimes[0] + epsilon);
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
      if (group.actorType === 'phantasm') {
        if (phantasmExecutions.length === 0) {
          throw new TypeError(`Phantasm strike ${skill.id} requires phantasm resource metadata.`);
        }
        for (const phantasm of phantasmExecutions) {
          const result = phantasms.scheduleStrike(phantasm, group, selectedGroup, at, castStart);
          addFencerStacks(result.initialHitTimes, result.damageGroup.hits);
          addFencerStacks(result.repeatHitTimes, result.damageGroup.hits);
        }
        continue;
      }
      const hitAt =
        group.castProgress != null
          ? castStart + (at - castStart) * Number(group.castProgress)
          : at + Number(group.atMs || 0) / 1000;
      if (hitAt > playerEffectEnd + epsilon) continue;
      const hitTimes = schedulePlayerStrike(skill, group, selectedGroup, at, castStart, pulseTimes);
      if (group.actorType === 'player') {
        playerHitTimes.push(...hitTimes);
        addFencerStacks(hitTimes, selectedGroup.hits);
      }
    }
    scheduleTrackedHits(skill, playerHitTimes);
    if (phantasmExecutions.length > 0) {
      const playerConditions = conditions.filter((effect) => effect.actorType === 'player');
      const phantasmConditions = conditions.filter((effect) => effect.actorType !== 'player');
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
    if (Number.isFinite(result.firstFencerTriggerAt)) {
      addTraitProc("Fencer's Finesse", result.firstFencerTriggerAt, skill.name);
    }
  };

  return { schedule, finish };
}
