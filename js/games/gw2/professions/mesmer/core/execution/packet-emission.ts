/**
 * Emits phantasm-cast packets and tracks their eligible sword hits.
 * Effect ordering lives in `effect-controller.ts`; persistent illusion behavior lives under `mechanics/illusions/`.
 */
import { emitFencersFinesseStacks, recordFencersFinesseProc } from '#gw2/professions/mesmer/core/traits/index.js';
import type {
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc
} from '#gw2/professions/mesmer/types.js';
import { castRelativeEffectTimingScale } from '#gw2/platform/skills/timing.js';
import type {
  MesmerPhantasmEffectController,
  MesmerPhantasmExecution
} from '#gw2/professions/mesmer/core/mechanics/illusions/phantasms.js';

import type {
  MesmerConditionEffect,
  MesmerDamageGroup,
  MesmerSkill,
  MesmerStrikeEffect
} from '#gw2/professions/mesmer/data/types.js';

export interface MesmerSkillDamageResult {
  readonly firstFencerTriggerAt: number;
}

export interface MesmerSkillDamageController {
  schedule(
    skill: MesmerSkill,
    at: number,
    castStart: number,
    playerEffectEnd: number,
    conditions: readonly MesmerConditionEffect[],
    phantasms: readonly MesmerPhantasmExecution[]
  ): MesmerSkillDamageResult;
  finish(skill: MesmerSkill, result: MesmerSkillDamageResult): void;
}

interface SkillDamageControllerOptions {
  readonly traits: ReadonlySet<number>;
  readonly epsilon: number;
  readonly phantasms: MesmerPhantasmEffectController;
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly addCondition: MesmerAddCondition;
  readonly addDamage: MesmerAddDamage;
}

export function createSkillDamageController({
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
    at: number,
    castStart: number
  ): readonly number[] => {
    const castScale =
      group.timingScale === 'cast' ? castRelativeEffectTimingScale(skill, Math.max(0, at - castStart) * 1000) : 1;
    // Mesmer's replacing handler materializes its own packets, so project the
    // same Quickness-authored timing that the shared scheduler would use.
    const timedGroup: MesmerDamageGroup =
      castScale === 1
        ? group
        : {
            ...group,
            ...(group.atMs == null ? {} : { atMs: Number(group.atMs) * castScale }),
            ...(Array.isArray(group.ticks)
              ? {
                  ticks: group.ticks.map((tick) => ({
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
      const hitAt = castStart + (at - castStart) * Number(group.castProgress);
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
    conditions: readonly MesmerConditionEffect[]
  ): void => {
    for (const effect of conditions) {
      const condition = { ...effect, name: effect.condition };
      const timingAnchorAt = effect.timingAnchor === 'castStart' ? castStart : at;
      addCondition(skill.name, timingAnchorAt, condition, 'Player');
    }
  };

  const schedule = (
    skill: MesmerSkill,
    at: number,
    castStart: number,
    playerEffectEnd: number,
    conditions: readonly MesmerConditionEffect[],
    phantasmExecutions: readonly MesmerPhantasmExecution[]
  ): MesmerSkillDamageResult => {
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
      if (group.summonKind === 'phantasm') {
        if (phantasmExecutions.length === 0) {
          throw new TypeError(`Phantasm strike ${skill.id} requires phantasm resource metadata.`);
        }

        for (const phantasm of phantasmExecutions) {
          const result = phantasms.scheduleStrike(phantasm, group, castStart);
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
      const hitTimes = schedulePlayerStrike(skill, group, at, castStart);
      if (group.actorType === 'player') {
        addFencerStacks(hitTimes, group.ticks?.length ?? group.hits);
      }
    }

    // Keep player conditions on the cast and summon conditions on each phantasm's own lifecycle.
    const playerConditions = conditions.filter((effect) => effect.summonKind !== 'phantasm');
    const phantasmConditions = conditions.filter((effect) => effect.summonKind === 'phantasm');
    schedulePlayerConditions(skill, at, castStart, playerConditions);
    for (const phantasm of phantasmExecutions) {
      phantasms.scheduleConditions(phantasm, phantasmConditions);
    }

    return { firstFencerTriggerAt };
  };

  const finish = (skill: MesmerSkill, result: MesmerSkillDamageResult): void => {
    recordFencersFinesseProc(fencersFinesseContext, skill, result.firstFencerTriggerAt);
  };

  return { schedule, finish };
}
