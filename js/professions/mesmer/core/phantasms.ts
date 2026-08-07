import {
  MESMER_SKILL_IDS as ID,
  MESMER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import type {
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerConditionEffect,
  MesmerDamageGroup,
  MesmerPhantasmAttackTiming,
  MesmerQueueResources,
  MesmerResourceDefinition,
  MesmerSkill,
  MesmerStrikeEffect,
  MesmerTraitDamage,
} from "../types.js";

export interface MesmerPhantasmExecution {
  readonly skill: MesmerSkill;
  readonly count: number;
  readonly damageMultiplier: number;
  readonly summonAt: number;
  readonly damageAt: number;
  readonly spawnAt: number;
  readonly repeatDamageAt: number;
  readonly conversionAt: number;
  readonly initialBladeAt: number;
  readonly hasChronophantasma: boolean;
  readonly virtuosoBladeTicks: readonly { readonly atMs: number }[] | null;
  readonly timing: MesmerPhantasmAttackTiming;
  readonly endpoint: (atMs: number | undefined) => number;
  chronophantasmaProc: boolean;
}

export interface MesmerPhantasmStrikeResult {
  readonly damageGroup: MesmerDamageGroup;
  readonly initialHitTimes: readonly number[];
}

export interface MesmerPhantasmEffectController {
  prepare(
    skill: MesmerSkill,
    castStart: number,
    summonAt: number,
    clarityConsumed: boolean,
  ): MesmerPhantasmExecution | null;
  scheduleLifecycle(execution: MesmerPhantasmExecution): void;
  scheduleStrike(
    execution: MesmerPhantasmExecution,
    group: MesmerStrikeEffect,
    selectedGroup: MesmerDamageGroup,
    at: number,
    castStart: number,
  ): MesmerPhantasmStrikeResult;
  scheduleConditions(
    execution: MesmerPhantasmExecution,
    conditions: readonly MesmerConditionEffect[],
  ): void;
  queueConversion(execution: MesmerPhantasmExecution): void;
}

interface PhantasmEffectControllerOptions {
  readonly traits: ReadonlySet<number>;
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly phantasmAttackTimings: Readonly<
    Record<number, MesmerPhantasmAttackTiming>
  >;
  readonly epsilon: number;
  readonly markCompounding: (at: number, count: number) => void;
  readonly queueResources: MesmerQueueResources;
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly addCondition: MesmerAddCondition;
  readonly addDamage: MesmerAddDamage;
  readonly traitDamage: Readonly<Record<string, MesmerTraitDamage>>;
}

export function createPhantasmEffectController({
  traits,
  resourceDefinition,
  phantasmAttackTimings,
  epsilon,
  markCompounding,
  queueResources,
  addEvent,
  addTraitProc,
  addCondition,
  addDamage,
  traitDamage,
}: PhantasmEffectControllerOptions): MesmerPhantasmEffectController {
  const prepare = (
    skill: MesmerSkill,
    castStart: number,
    summonAt: number,
    clarityConsumed: boolean,
  ): MesmerPhantasmExecution | null => {
    if (skill.resource?.mode !== "phantasm") return null;
    const bountifulBerserker =
      skill.id === ID.PHANTASMAL_BERSERKER
      && traits.has(TRAIT.BOUNTIFUL_BLADES);
    const count =
      Number(skill.resource.count || 1)
      * (skill.id === ID.PHANTASMAL_LANCER && clarityConsumed ? 2 : 1)
      * (bountifulBerserker ? 2 : 1);
    const timing = phantasmAttackTimings[skill.id];
    if (!timing) {
      throw new TypeError(
        `Phantasm skill ${skill.id} requires attack timing metadata.`,
      );
    }
    const speed = traits.has(TRAIT.PHANTASMAL_HASTE) ? 1.5 : 1;
    const endpoint = (atMs: number | undefined): number => {
      const measuredPostCast = Number(atMs) / 1000;
      const actualCastTime = summonAt - castStart;
      return castStart + actualCastTime + measuredPostCast / speed;
    };
    const damageAt = endpoint(timing?.damageAtMs);
    const spawnAt = endpoint(timing?.spawnAtMs);
    const repeatDamageAt = endpoint(timing?.chronophantasmaDamageAtMs);
    const hasChronophantasma = traits.has(TRAIT.CHRONOPHANTASMA);
    return {
      skill,
      count,
      damageMultiplier: bountifulBerserker ? 0.66 : 1,
      summonAt,
      damageAt,
      spawnAt,
      repeatDamageAt,
      conversionAt: hasChronophantasma
        ? endpoint(timing?.chronophantasmaSpawnAtMs)
        : spawnAt,
      initialBladeAt:
        timing?.phantasmalBladeDelayAfterSpawnMs != null
          ? spawnAt
            + Number(timing.phantasmalBladeDelayAfterSpawnMs) / 1000
          : damageAt,
      hasChronophantasma,
      virtuosoBladeTicks:
        resourceDefinition.singular === "blade"
        && !hasChronophantasma
        && Array.isArray(timing?.virtuosoBladeTicks)
          ? timing.virtuosoBladeTicks
          : null,
      timing,
      endpoint,
      chronophantasmaProc: false,
    };
  };

  const addPhantasmalBlade = (
    execution: MesmerPhantasmExecution,
    at: number,
    sourceSkill: string,
  ): void => {
    const blade = traitDamage["Phantasmal Blade"];
    addDamage(
      {
        id: "Phantasmal Blade",
        name: "Phantasmal Blade",
        weapon: execution.skill.weapon,
        blade: true,
      },
      at,
      {
        coefficient: blade.coefficient * execution.count,
        hits: blade.hits * execution.count,
        source: "Player",
        weaponStrength: blade.weaponStrength,
      },
    );
    addTraitProc("Phantasmal Blades", at, sourceSkill);
  };

  const scheduleLifecycle = (execution: MesmerPhantasmExecution): void => {
    const { skill, count } = execution;
    if (traits.has(TRAIT.COMPOUNDING_POWER)) {
      markCompounding(execution.summonAt, count);
      addTraitProc(
        "Compounding Power",
        execution.summonAt,
        skill.name,
        `${count} phantasm${count === 1 ? "" : "s"}`,
      );
    }
    addEvent({
      type: "mesmer.phantasm-summoned",
      at: execution.summonAt,
      name: skill.name,
      count,
    });
    addEvent({
      type: "mesmer.phantasm-attack",
      at: execution.damageAt,
      name: skill.name,
      count,
      repeat: false,
      complete: true,
    });
    if (traits.has(TRAIT.PHANTASMAL_BLADES)) {
      addPhantasmalBlade(execution, execution.initialBladeAt, skill.name);
    }
    if (!execution.hasChronophantasma) return;
    if (traits.has(TRAIT.COMPOUNDING_POWER)) {
      markCompounding(execution.spawnAt, count);
      addTraitProc(
        "Compounding Power",
        execution.spawnAt,
        `${skill.name} - Chronophantasma`,
        `${count} phantasm${count === 1 ? "" : "s"}`,
      );
    }
    addEvent({
      type: "mesmer.phantasm-resummoned",
      at: execution.spawnAt,
      name: skill.name,
      count,
    });
    addEvent({
      type: "mesmer.phantasm-attack",
      at: execution.repeatDamageAt,
      name: skill.name,
      count,
      repeat: true,
      complete: true,
    });
    if (traits.has(TRAIT.PHANTASMAL_BLADES)) {
      addPhantasmalBlade(
        execution,
        execution.repeatDamageAt,
        `${skill.name} - Chronophantasma`,
      );
    }
  };

  const scheduleStrike = (
    execution: MesmerPhantasmExecution,
    group: MesmerStrikeEffect,
    selectedGroup: MesmerDamageGroup,
    at: number,
    castStart: number,
  ): MesmerPhantasmStrikeResult => {
    const sourcedGroup: MesmerDamageGroup = {
      ...selectedGroup,
      source: "Phantasm",
    };
    const baseTicks = Array.isArray(sourcedGroup.ticks)
      ? sourcedGroup.ticks
      : null;
    const baseHits = baseTicks?.length
      || Math.max(1, Math.trunc(Number(sourcedGroup.hits || 1)));
    const baseCoefficient = baseTicks
      ? baseTicks.reduce(
          (total, tick) => total + Number(tick.coefficient),
          0,
        )
      : Number(sourcedGroup.coefficient || 0);
    const damageGroup: MesmerDamageGroup = {
      ...sourcedGroup,
      ticks: undefined,
      coefficient:
        baseCoefficient * execution.count * execution.damageMultiplier,
      hits: baseHits * execution.count,
    };
    const groupName = group.name || "";
    const measuredTicks =
      Array.isArray(execution.timing?.damageTicks?.[groupName])
        ? execution.timing?.damageTicks?.[groupName]
        : null;
    const fixedTicks = group.ticks?.length ? group.ticks : null;
    const packets = measuredTicks?.length ? measuredTicks : fixedTicks;
    const interval = Number(group.intervalMs || 0);
    let initialHitTimes: readonly number[];
    if (packets?.length) {
      const hits = Math.max(
        1,
        Math.trunc(Number(damageGroup.hits || 1)),
      );
      const timingAnchorAt = measuredTicks?.length
        ? castStart
        : group.timingAnchor === "castStart" ? castStart : at;
      const ticks = Array.from({ length: hits }, (_, index) => {
        const packet = packets[index % packets.length];
        const packetAt = measuredTicks?.length
          ? execution.endpoint(packet.atMs)
          : timingAnchorAt + Number(packet.atMs) / 1000;
        return {
          atMs: (packetAt - timingAnchorAt) * 1000,
          coefficient: fixedTicks?.length
            ? Number(packet.coefficient) * execution.damageMultiplier
            : Number(damageGroup.coefficient || 0) / hits,
        };
      });
      initialHitTimes = addDamage(execution.skill, timingAnchorAt, {
        ...damageGroup,
        coefficient: undefined,
        hits: undefined,
        atMs: undefined,
        intervalMs: undefined,
        ticks,
        timingAnchor: "castStart",
        timingScale: "fixed",
      }).map((event) => event.at);
    } else if (interval > 0 && Number(damageGroup.hits || 1) > 1) {
      const timingAnchorAt = group.timingAnchor === "castStart" ? castStart : at;
      initialHitTimes = addDamage(
        execution.skill,
        timingAnchorAt,
        damageGroup,
      ).map((event) => event.at);
    } else {
      initialHitTimes = addDamage(execution.skill, execution.damageAt, {
        ...damageGroup,
        atMs: undefined,
        intervalMs: undefined,
        timingAnchor: undefined,
        timingScale: undefined,
      }).map((event) => event.at);
    }
    if (execution.hasChronophantasma) {
      addDamage(execution.skill, execution.repeatDamageAt, {
        ...damageGroup,
        atMs: undefined,
        intervalMs: undefined,
        timingAnchor: undefined,
        timingScale: undefined,
      }, {
        name: `${execution.skill.name} - Chronophantasma`,
        multiplier: 1.05,
      });
      if (!execution.chronophantasmaProc) {
        addTraitProc(
          "Chronophantasma",
          execution.spawnAt,
          execution.skill.name,
        );
        execution.chronophantasmaProc = true;
      }
    }
    return { damageGroup, initialHitTimes };
  };

  const scheduleConditions = (
    execution: MesmerPhantasmExecution,
    conditions: readonly MesmerConditionEffect[],
  ): void => {
    for (const effect of conditions) {
      const condition = { ...effect, name: effect.condition };
      const scaledCondition = execution.count > 1
        ? {
            ...condition,
            stacks: Number(condition.stacks || 1) * execution.count,
          }
        : condition;
      const conditionTicks =
        condition.packetLabel
        && Array.isArray(
          execution.timing?.damageTicks?.[condition.packetLabel],
        )
          ? execution.timing?.damageTicks?.[condition.packetLabel]
          : null;
      if (conditionTicks && conditionTicks.length > 0) {
        const packetStacks =
          Number(scaledCondition.stacks || 1) / conditionTicks.length;
        const applicationTimes = conditionTicks.map((tick) =>
          execution.endpoint(tick.atMs)
        );
        const conditionOrigin = Math.min(...applicationTimes);
        addCondition(execution.skill.name, conditionOrigin, {
          ...scaledCondition,
          stacks: undefined,
          ticks: applicationTimes.map((applicationAt) => ({
            atMs: (applicationAt - conditionOrigin) * 1000,
            condition: scaledCondition.name,
            duration: scaledCondition.duration,
            stacks: packetStacks,
          })),
          timingAnchor: "castStart",
          timingScale: "fixed",
        }, "Phantasm");
      } else {
        addCondition(
          execution.skill.name,
          execution.damageAt,
          scaledCondition,
          "Phantasm",
        );
      }
    }
    if (!execution.hasChronophantasma || conditions.length === 0) return;
    for (const effect of conditions) {
      const condition = { ...effect, name: effect.condition };
      const scaledCondition = execution.count > 1
        ? {
            ...condition,
            stacks: Number(condition.stacks || 1) * execution.count,
          }
        : condition;
      addCondition(
        execution.skill.name,
        execution.repeatDamageAt,
        scaledCondition,
        "Phantasm",
        `${execution.skill.name} - Chronophantasma`,
      );
    }
  };

  const queueConversion = (execution: MesmerPhantasmExecution): void => {
    if (execution.virtuosoBladeTicks) {
      for (let index = 0; index < execution.count; index += 1) {
        const tick = execution.virtuosoBladeTicks[
          Math.min(index, execution.virtuosoBladeTicks.length - 1)
        ];
        queueResources(
          execution.endpoint(tick.atMs) + epsilon,
          1,
          null,
          `${execution.skill.name} phantasm conversion`,
          {
            kind: "phantasm-conversion",
            sourceSkillId: execution.skill.id,
          },
        );
      }
      return;
    }
    queueResources(
      execution.conversionAt + epsilon,
      execution.count,
      null,
      `${execution.skill.name} phantasm conversion`,
      { kind: "phantasm-conversion", sourceSkillId: execution.skill.id },
    );
  };

  return {
    prepare,
    scheduleLifecycle,
    scheduleStrike,
    scheduleConditions,
    queueConversion,
  };
}
