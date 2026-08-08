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
  readonly entityIndex: number;
  readonly damageMultiplier: number;
  readonly summonAt: number;
  readonly damageAt: number;
  readonly spawnAt: number;
  readonly repeatDamageAt: number;
  readonly conversionAt: number;
  readonly initialBladeAt: number;
  readonly hasChronophantasma: boolean;
  readonly virtuosoBladeAt: number | null;
  readonly timing: MesmerPhantasmAttackTiming;
  readonly endpoint: (atMs: number | undefined) => number;
}

export interface MesmerPhantasmStrikeResult {
  readonly damageGroup: MesmerDamageGroup;
  readonly initialHitTimes: readonly number[];
  readonly repeatHitTimes: readonly number[];
}

export interface MesmerPhantasmEffectController {
  prepare(
    skill: MesmerSkill,
    castStart: number,
    summonAt: number,
    clarityConsumed: boolean,
  ): readonly MesmerPhantasmExecution[];
  scheduleLifecycle(executions: readonly MesmerPhantasmExecution[]): void;
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
  queueConversion(execution: MesmerPhantasmExecution, amount?: number): void;
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
  ): readonly MesmerPhantasmExecution[] => {
    if (skill.resource?.mode !== "phantasm") return [];
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
    const hasChronophantasma = traits.has(TRAIT.CHRONOPHANTASMA);
    return Array.from({ length: count }, (_, entityIndex) => {
      const damageAt = endpoint(
        timing.damageAtMsByEntity?.[entityIndex] ?? timing.damageAtMs,
      );
      const spawnAt = endpoint(timing.spawnAtMs);
      const repeatDamageAt = endpoint(
        timing.chronophantasmaDamageAtMsByEntity?.[entityIndex]
          ?? timing.chronophantasmaDamageAtMs,
      );
      const virtuosoBladeTick = timing.virtuosoBladeTicks?.[
        Math.min(entityIndex, timing.virtuosoBladeTicks.length - 1)
      ];
      return {
        skill,
        entityIndex,
        damageMultiplier: bountifulBerserker ? 0.66 : 1,
        summonAt,
        damageAt,
        spawnAt,
        repeatDamageAt,
        conversionAt: hasChronophantasma
          ? endpoint(timing.chronophantasmaSpawnAtMs)
          : spawnAt,
        initialBladeAt:
          timing.phantasmalBladeDelayAfterSpawnMs != null
            ? spawnAt
              + Number(timing.phantasmalBladeDelayAfterSpawnMs) / 1000
            : damageAt,
        hasChronophantasma,
        virtuosoBladeAt:
          resourceDefinition.singular === "blade"
          && !hasChronophantasma
          && virtuosoBladeTick
            ? endpoint(virtuosoBladeTick.atMs)
            : null,
        timing,
        endpoint,
      };
    });
  };

  const addPhantasmalBlade = (
    execution: MesmerPhantasmExecution,
    at: number,
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
        coefficient: blade.coefficient,
        hits: blade.hits,
        source: "Player",
        weaponStrength: blade.weaponStrength,
      },
    );
  };

  const scheduleLifecycle = (
    executions: readonly MesmerPhantasmExecution[],
  ): void => {
    const execution = executions[0];
    if (!execution) return;
    const { skill } = execution;
    const count = executions.length;
    const damageAt = Math.max(...executions.map((item) => item.damageAt));
    const repeatDamageAt = Math.max(
      ...executions.map((item) => item.repeatDamageAt),
    );
    const initialBladeAt = Math.max(
      ...executions.map((item) => item.initialBladeAt),
    );
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
      at: damageAt,
      name: skill.name,
      count,
      repeat: false,
      complete: true,
    });
    if (traits.has(TRAIT.PHANTASMAL_BLADES)) {
      for (const item of executions) {
        addPhantasmalBlade(item, item.initialBladeAt);
      }
      addTraitProc("Phantasmal Blades", initialBladeAt, skill.name);
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
      at: repeatDamageAt,
      name: skill.name,
      count,
      repeat: true,
      complete: true,
    });
    if (traits.has(TRAIT.PHANTASMAL_BLADES)) {
      for (const item of executions) {
        addPhantasmalBlade(
          item,
          item.repeatDamageAt,
        );
      }
      addTraitProc(
        "Phantasmal Blades",
        repeatDamageAt,
        `${skill.name} - Chronophantasma`,
      );
    }
    addTraitProc("Chronophantasma", execution.spawnAt, skill.name);
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
      coefficient: baseCoefficient * execution.damageMultiplier,
      hits: baseHits,
    };
    const groupName = group.name || "";
    const measuredTicks =
      execution.timing.damageTicksByEntity?.[execution.entityIndex]?.[
        groupName
      ]
      ?? (Array.isArray(execution.timing.damageTicks?.[groupName])
        ? execution.timing.damageTicks[groupName]
        : null);
    const fixedTicks = group.ticks?.length ? group.ticks : null;
    const packets = measuredTicks?.length ? measuredTicks : fixedTicks;
    const interval = Number(group.intervalMs || 0);
    let initialEvents: ReturnType<MesmerAddDamage>;
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
          coefficient: measuredTicks?.length
            ? Number(damageGroup.coefficient || 0) / hits
            : Number(packet.coefficient) * execution.damageMultiplier,
        };
      });
      initialEvents = addDamage(execution.skill, timingAnchorAt, {
        ...damageGroup,
        coefficient: undefined,
        hits: undefined,
        atMs: undefined,
        intervalMs: undefined,
        ticks,
        timingAnchor: "castStart",
        timingScale: "fixed",
      });
    } else if (interval > 0 && Number(damageGroup.hits || 1) > 1) {
      const timingAnchorAt = group.timingAnchor === "castStart" ? castStart : at;
      initialEvents = addDamage(
        execution.skill,
        timingAnchorAt,
        damageGroup,
      );
    } else {
      initialEvents = addDamage(execution.skill, execution.damageAt, {
        ...damageGroup,
        atMs: undefined,
        intervalMs: undefined,
        timingAnchor: undefined,
        timingScale: undefined,
      });
    }
    const initialHitTimes = initialEvents.map((event) => event.at);
    let repeatHitTimes: readonly number[] = [];
    if (execution.hasChronophantasma) {
      const repeatMeasuredTicks =
        execution.timing.chronophantasmaDamageTicksByEntity?.[
          execution.entityIndex
        ]?.[groupName]
        ?? execution.timing.chronophantasmaDamageTicks?.[groupName]
        ?? null;
      if (repeatMeasuredTicks?.length) {
        const hits = Math.max(
          1,
          Math.trunc(Number(damageGroup.hits || 1)),
        );
        repeatHitTimes = addDamage(execution.skill, castStart, {
          ...damageGroup,
          coefficient: undefined,
          hits: undefined,
          atMs: undefined,
          intervalMs: undefined,
          ticks: Array.from({ length: hits }, (_, index) => ({
            atMs:
              (execution.endpoint(
                repeatMeasuredTicks[index % repeatMeasuredTicks.length].atMs,
              ) - castStart) * 1000,
            coefficient: Number(damageGroup.coefficient || 0) / hits,
          })),
          timingAnchor: "castStart",
          timingScale: "fixed",
        }, {
          name: `${execution.skill.name} - Chronophantasma`,
          multiplier: 1.05,
        }).map((event) => event.at);
      } else {
        const repeatOffset = execution.repeatDamageAt - execution.damageAt;
        const shiftedHitTimes = initialHitTimes.map(
          (hitAt) => hitAt + repeatOffset,
        );
        if (shiftedHitTimes.length > 0) {
          const repeatOrigin = Math.min(...shiftedHitTimes);
          repeatHitTimes = addDamage(execution.skill, repeatOrigin, {
            ...damageGroup,
            coefficient: undefined,
            hits: undefined,
            atMs: undefined,
            intervalMs: undefined,
            ticks: initialEvents.map((event, index) => ({
              atMs: (shiftedHitTimes[index] - repeatOrigin) * 1000,
              coefficient: Number(event.coefficient || 0),
            })),
            timingAnchor: "castStart",
            timingScale: "fixed",
          }, {
            name: `${execution.skill.name} - Chronophantasma`,
            multiplier: 1.05,
          }).map((event) => event.at);
        }
      }
    }
    return { damageGroup, initialHitTimes, repeatHitTimes };
  };

  const scheduleConditions = (
    execution: MesmerPhantasmExecution,
    conditions: readonly MesmerConditionEffect[],
  ): void => {
    const entityConditions = conditions.filter(
      (effect) =>
        effect.phantasmEntityIndex == null ||
        effect.phantasmEntityIndex === execution.entityIndex,
    );
    const conditionEventExtra = {
      source: "Phantasm",
      sourceId: execution.skill.id,
      skillId: execution.skill.id,
      actorType: "summon" as const,
    };
    for (const effect of entityConditions) {
      const condition = { ...effect, name: effect.condition };
      const conditionTicks = condition.packetLabel
        ? execution.timing.damageTicksByEntity?.[execution.entityIndex]?.[
            condition.packetLabel
          ]
          ?? execution.timing.damageTicks?.[condition.packetLabel]
          ?? null
        : null;
      if (conditionTicks && conditionTicks.length > 0) {
        const packetStacks =
          Number(condition.stacks || 1) / conditionTicks.length;
        const applicationTimes = conditionTicks.map((tick) =>
          execution.endpoint(tick.atMs)
        );
        const conditionOrigin = Math.min(...applicationTimes);
        addCondition(execution.skill.name, conditionOrigin, {
          ...condition,
          stacks: undefined,
          ticks: applicationTimes.map((applicationAt) => ({
            atMs: (applicationAt - conditionOrigin) * 1000,
            condition: condition.name,
            duration: condition.duration,
            stacks: packetStacks,
          })),
          timingAnchor: "castStart",
          timingScale: "fixed",
        }, "Phantasm", "", conditionEventExtra);
      } else {
        addCondition(
          execution.skill.name,
          execution.damageAt,
          condition,
          "Phantasm",
          "",
          conditionEventExtra,
        );
      }
    }
    if (!execution.hasChronophantasma || entityConditions.length === 0) return;
    const repeatOffset = execution.repeatDamageAt - execution.damageAt;
    for (const effect of entityConditions) {
      const condition = { ...effect, name: effect.condition };
      const initialConditionTicks =
        condition.packetLabel
          ? execution.timing.damageTicksByEntity?.[execution.entityIndex]?.[
              condition.packetLabel
            ]
            ?? execution.timing.damageTicks?.[condition.packetLabel]
            ?? null
          : null;
      const repeatConditionTicks =
        condition.packetLabel
          ? execution.timing.chronophantasmaDamageTicksByEntity?.[
              execution.entityIndex
            ]?.[condition.packetLabel]
            ?? execution.timing.chronophantasmaDamageTicks?.[
              condition.packetLabel
            ]
            ?? null
          : null;
      const conditionTicks = repeatConditionTicks ?? initialConditionTicks;
      if (conditionTicks && conditionTicks.length > 0) {
        const packetStacks =
          Number(condition.stacks || 1) / conditionTicks.length;
        const applicationTimes = conditionTicks.map((tick) =>
          repeatConditionTicks
            ? execution.endpoint(tick.atMs)
            : execution.endpoint(tick.atMs) + repeatOffset
        );
        const conditionOrigin = Math.min(...applicationTimes);
        addCondition(execution.skill.name, conditionOrigin, {
          ...condition,
          stacks: undefined,
          ticks: applicationTimes.map((applicationAt) => ({
            atMs: (applicationAt - conditionOrigin) * 1000,
            condition: condition.name,
            duration: condition.duration,
            stacks: packetStacks,
          })),
          timingAnchor: "castStart",
          timingScale: "fixed",
        }, "Phantasm", `${execution.skill.name} - Chronophantasma`,
        conditionEventExtra);
      } else {
        addCondition(
          execution.skill.name,
          execution.repeatDamageAt,
          condition,
          "Phantasm",
          `${execution.skill.name} - Chronophantasma`,
          conditionEventExtra,
        );
      }
    }
  };

  const queueConversion = (
    execution: MesmerPhantasmExecution,
    amount = 1,
  ): void => {
    if (execution.virtuosoBladeAt != null) {
      queueResources(
        execution.virtuosoBladeAt + epsilon,
        amount,
        null,
        `${execution.skill.name} phantasm conversion`,
        {
          kind: "phantasm-conversion",
          sourceSkillId: execution.skill.id,
        },
      );
      return;
    }
    queueResources(
      execution.conversionAt + epsilon,
      amount,
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
