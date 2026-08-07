import { professionCoreState } from "../../../platform/engine/profession.js";
import { MESMER_TRAIT_IDS as TRAIT } from "../data/ids.js";
import type { Gw2DamageGroup } from "../../../platform/gw2/types.js";
import type {
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerConditionEffect,
  MesmerConfig,
  MesmerRuntimeState,
  MesmerSkill,
  MesmerStrikeEffect,
} from "../types.js";
import type { SchedulerState } from "../../../platform/engine/types.js";
import type {
  MesmerPhantasmEffectController,
  MesmerPhantasmExecution,
} from "./phantasms.js";

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
    phantasm: MesmerPhantasmExecution | null,
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
  addDamage,
}: SkillDamageControllerOptions): MesmerSkillDamageController {
  const schedulePlayerStrike = (
    skill: MesmerSkill,
    group: MesmerStrikeEffect,
    selectedGroup: Gw2DamageGroup,
    at: number,
    castStart: number,
    pulseTimes: readonly number[],
  ): readonly number[] => {
    const damageGroup: Gw2DamageGroup = {
      ...selectedGroup,
      source: "Player",
    };
    const fixedTicks = group.ticks?.length ? group.ticks : null;
    const interval = Number(group.intervalMs || 0) / 1000;
    const hitTimes: number[] = [];
    if (fixedTicks?.length) {
      const hits = Math.max(
        1,
        Math.trunc(Number(damageGroup.hits || fixedTicks.length || 1)),
      );
      const timingAnchorAt = group.timingAnchor === "castStart" ? castStart : at;
      for (let index = 0; index < hits; index += 1) {
        const packet = fixedTicks[index % fixedTicks.length];
        const packetAt = timingAnchorAt + Number(packet.atMs) / 1000;
        hitTimes.push(packetAt);
        addDamage(skill, packetAt, {
          ...damageGroup,
          coefficient: Number(packet.coefficient),
          hits: 1,
        });
      }
    } else if (interval > 0 && Number(damageGroup.hits || 1) > 1) {
      const hits = Math.max(1, Math.trunc(Number(damageGroup.hits || 1)));
      const timingAnchorAt = group.timingAnchor === "castStart" ? castStart : at;
      for (let index = 0; index < hits; index += 1) {
        const packetAt =
          timingAnchorAt + Number(group.atMs || 0) / 1000 + index * interval;
        hitTimes.push(packetAt);
        addDamage(skill, packetAt, {
          ...damageGroup,
          coefficient: Number(damageGroup.coefficient || 0) / hits,
          hits: 1,
        });
      }
    } else if (
      pulseTimes.length > 0
      && Number(damageGroup.hits || 1) === pulseTimes.length
    ) {
      for (const pulseAt of pulseTimes) {
        hitTimes.push(pulseAt);
        addDamage(skill, pulseAt, {
          ...damageGroup,
          coefficient:
            Number(damageGroup.coefficient || 0) / pulseTimes.length,
          hits: 1,
        });
      }
    } else {
      const hitAt = group.castProgress != null
        ? castStart + (at - castStart) * Number(group.castProgress)
        : at + Number(group.atMs || 0) / 1000;
      hitTimes.push(hitAt);
      addDamage(skill, hitAt, damageGroup);
    }
    return hitTimes;
  };

  const scheduleTrackedHits = (
    skill: MesmerSkill,
    playerHitTimes: readonly number[],
  ): void => {
    if (!skill.trackedHitDamage) return;
    const tracking = skill.trackedHitDamage;
    const duration = Number(tracking.duration || 0);
    let recentHits = [
      ...(professionCoreState(state).trackedSkillHits[skill.id] || []),
    ];
    const required = Math.max(
      1,
      Math.trunc(Number(tracking.hitsRequired || 1)),
    );
    for (const currentHitAt of [...playerHitTimes].sort((a, b) => a - b)) {
      const minimum = currentHitAt - duration;
      recentHits = recentHits.filter((hitAt) => hitAt > minimum + epsilon);
      recentHits.push(currentHitAt);
      while (recentHits.length >= required) {
        const triggerHits = recentHits.splice(0, required);
        const triggerAt = triggerHits[triggerHits.length - 1];
        const ticks = tracking.ticks;
        if (Array.isArray(ticks) && ticks.length > 0) {
          for (const tick of ticks) {
            addDamage(
              skill,
              triggerAt + Number(tick.atMs) / 1000,
              {
                ...tracking,
                coefficient: Number(tick.coefficient),
                hits: 1,
              },
              {
                blade: skill.blade,
                name: tracking.name,
                skillName: tracking.name,
                parentSkillName: skill.name,
                sourceId: tracking.skillId ?? skill.id,
                skillId: tracking.skillId ?? skill.id,
              },
            );
          }
        } else {
          addDamage(skill, triggerAt, tracking, {
            blade: skill.blade,
            name: tracking.name,
            skillName: tracking.name,
            parentSkillName: skill.name,
            sourceId: tracking.skillId ?? skill.id,
            skillId: tracking.skillId ?? skill.id,
          });
        }
      }
    }
    professionCoreState(state).trackedSkillHits[skill.id] = recentHits;
  };

  const schedulePlayerConditions = (
    skill: MesmerSkill,
    at: number,
    pulseTimes: readonly number[],
    conditions: readonly MesmerConditionEffect[],
  ): void => {
    for (const effect of conditions) {
      const condition = { ...effect, name: effect.condition };
      if (
        pulseTimes.length > 0
        && Number(condition.stacks || 1) === pulseTimes.length
      ) {
        for (const pulseAt of pulseTimes) {
          addCondition(skill.name, pulseAt, { ...condition, stacks: 1 });
        }
      } else {
        addCondition(skill.name, at, condition, "Player");
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
    phantasm: MesmerPhantasmExecution | null,
  ): MesmerSkillDamageResult => {
    const playerHitTimes: number[] = [];
    let firstFencerTriggerAt = Infinity;
    const addFencerStacks = (
      hitTimes: readonly number[],
      hits: number | undefined,
    ): void => {
      if (
        !traits.has(TRAIT.FENCERS_FINESSE)
        || skill.weapon !== "Sword"
        || hitTimes.length === 0
      ) {
        return;
      }
      const hitCount = Math.max(1, Math.trunc(Number(hits || 1)));
      if (hitTimes.length === hitCount) {
        for (const hitAt of hitTimes) {
          addEvent({
            type: "buff",
            at: hitAt + epsilon,
            kind: "fencer",
            stacks: 1,
            duration: 6,
          });
          firstFencerTriggerAt = Math.min(firstFencerTriggerAt, hitAt + epsilon);
        }
        return;
      }
      addEvent({
        type: "buff",
        at: hitTimes[0] + epsilon,
        kind: "fencer",
        stacks: Math.min(10, hitCount),
        duration: 6,
      });
      firstFencerTriggerAt = Math.min(
        firstFencerTriggerAt,
        hitTimes[0] + epsilon,
      );
    };

    const strikeEffects = (skill.effects || []).filter(
      (effect): effect is MesmerStrikeEffect => effect.type === "strike",
    );
    for (const group of strikeEffects) {
      if (group.requiredTrait && !traits.has(group.requiredTrait)) continue;
      const selectedGroup: Gw2DamageGroup =
        skill.boonlessCoefficient && config.target?.boonless
          ? { ...group, coefficient: skill.boonlessCoefficient }
          : group;
      if (group.actorType === "phantasm") {
        if (!phantasm) {
          throw new TypeError(
            `Phantasm strike ${skill.id} requires phantasm resource metadata.`,
          );
        }
        const result = phantasms.scheduleStrike(
          phantasm,
          group,
          selectedGroup,
          at,
          castStart,
        );
        addFencerStacks(result.initialHitTimes, result.damageGroup.hits);
        if (phantasm.hasChronophantasma) {
          addFencerStacks([phantasm.repeatDamageAt], result.damageGroup.hits);
        }
        continue;
      }
      const hitAt = group.castProgress != null
        ? castStart + (at - castStart) * Number(group.castProgress)
        : at + Number(group.atMs || 0) / 1000;
      if (hitAt > playerEffectEnd + epsilon) continue;
      const hitTimes = schedulePlayerStrike(
        skill,
        group,
        selectedGroup,
        at,
        castStart,
        pulseTimes,
      );
      if (group.actorType === "player") {
        playerHitTimes.push(...hitTimes);
        addFencerStacks(hitTimes, selectedGroup.hits);
      }
    }
    scheduleTrackedHits(skill, playerHitTimes);
    if (phantasm) {
      phantasms.scheduleConditions(phantasm, conditions);
    } else {
      schedulePlayerConditions(skill, at, pulseTimes, conditions);
    }
    return { firstFencerTriggerAt };
  };

  const finish = (
    skill: MesmerSkill,
    result: MesmerSkillDamageResult,
  ): void => {
    if (Number.isFinite(result.firstFencerTriggerAt)) {
      addTraitProc(
        "Fencer's Finesse",
        result.firstFencerTriggerAt,
        skill.name,
      );
    }
  };

  return { schedule, finish };
}
