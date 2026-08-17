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
  // Index among co-spawned entities (e.g. Bountiful Blades spawns 2 Berserkers: 0 and 1).
  readonly entityIndex: number;
  // Scales coefficient down when multiple phantasms share a skill's total damage budget (Bountiful Blades: 0.66).
  readonly damageMultiplier: number;
  readonly summonAt: number;
  readonly damageAt: number;
  // When Chronophantasma re-summons the phantasm; equals damageAt without the trait.
  readonly spawnAt: number;
  // Timestamp for the Chronophantasma repeat attack; unused without the trait.
  readonly repeatDamageAt: number;
  // When the phantasm converts to a blade/resource. Equals spawnAt normally;
  // equals Chronophantasma re-spawn time when that trait is active.
  readonly conversionAt: number;
  // When Phantasmal Blades fires — uses a post-spawn delay if the skill specifies one,
  // otherwise aligns with the first damage hit.
  readonly initialBladeAt: number;
  readonly hasChronophantasma: boolean;
  // Non-null only for Virtuoso (blade resource), overrides conversionAt so the blade
  // queues off the phantasm's measured blade-tick time instead of the spawn time.
  readonly virtuosoBladeAt: number | null;
  readonly timing: MesmerPhantasmAttackTiming;
  // Converts a raw post-cast millisecond offset from timing metadata into a simulation
  // timestamp, accounting for cast duration and Phantasmal Haste speed scaling.
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

function phantasmAttackDisplayName(
  skillId: number,
  damageGroupName: string,
): string {
  if (skillId !== ID.PHANTASMAL_SWORDSMAN) return "";
  if (damageGroupName === "Phantasm leap") return "Sword Attack";
  if (damageGroupName === "Phantasm Blurred Frenzy") return "Blurred Frenzy";
  return "";
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

    // Bountiful Blades (Virtuoso trait) spawns 2 Berserkers at 66% damage each.
    const bountifulBerserker =
      skill.id === ID.PHANTASMAL_BERSERKER &&
      traits.has(TRAIT.BOUNTIFUL_BLADES);

    // Clarity (Herald legend) doubles Lancer's phantasm count when consumed on cast.
    const count =
      Number(skill.resource.count || 1) *
      (skill.id === ID.PHANTASMAL_LANCER && clarityConsumed ? 2 : 1) *
      (bountifulBerserker ? 2 : 1);

    const timing = phantasmAttackTimings[skill.id];
    if (!timing) {
      throw new TypeError(
        `Phantasm skill ${skill.id} requires attack timing metadata.`,
      );
    }

    // Phantasmal Haste compresses all post-cast timing offsets by 1/speed.
    const speed = traits.has(TRAIT.PHANTASMAL_HASTE) ? 1.5 : 1;
    const endpoint = (atMs: number | undefined): number => {
      const measuredPostCast = Number(atMs) / 1000;
      const actualCastTime = summonAt - castStart;
      return castStart + actualCastTime + measuredPostCast / speed;
    };

    const hasChronophantasma = traits.has(TRAIT.CHRONOPHANTASMA);

    // Each entity in the spawn batch gets its own execution so per-entity timing
    // offsets (e.g. staggered Berserker attacks) are preserved independently.
    return Array.from({ length: count }, (_, entityIndex) => {
      const damageAt = endpoint(
        timing.damageAtMsByEntity?.[entityIndex] ?? timing.damageAtMs,
      );
      const spawnAt = endpoint(timing.spawnAtMs);
      const repeatDamageAt = endpoint(
        timing.chronophantasmaDamageAtMsByEntity?.[entityIndex] ??
          timing.chronophantasmaDamageAtMs,
      );
      // Blade ticks table may have fewer entries than phantasm count; clamp to last entry.
      const virtuosoBladeTick =
        timing.virtuosoBladeTicks?.[
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
        // With Chronophantasma the phantasm re-spawns after its first attack cycle;
        // the resource conversion happens at that later re-spawn time, not at spawnAt.
        conversionAt: hasChronophantasma
          ? endpoint(timing.chronophantasmaSpawnAtMs)
          : spawnAt,
        initialBladeAt:
          timing.phantasmalBladeDelayAfterSpawnMs != null
            ? spawnAt + Number(timing.phantasmalBladeDelayAfterSpawnMs) / 1000
            : damageAt,
        hasChronophantasma,
        // Virtuoso blade conversion uses a measured per-phantasm tick time rather than
        // the generic spawn time. Disabled under Chronophantasma (phantasm doesn't convert).
        virtuosoBladeAt:
          resourceDefinition.singular === "blade" &&
          !hasChronophantasma &&
          virtuosoBladeTick
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

    // Lifecycle events use the latest entity's timestamp so the "complete" marker
    // fires after every entity in the batch has finished attacking.
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
      // Each entity fires its own blade proc at its own initialBladeAt.
      for (const item of executions) {
        addPhantasmalBlade(item, item.initialBladeAt);
      }
      addTraitProc("Phantasmal Blades", initialBladeAt, skill.name);
    }
    if (!execution.hasChronophantasma) return;

    // Chronophantasma re-summons the phantasm at spawnAt for a second attack cycle.
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
        addPhantasmalBlade(item, item.repeatDamageAt);
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
    // Flatten tick-array definitions into a single coefficient sum so the damageGroup
    // holds a scalar value regardless of how the source data was authored.
    const baseTicks = Array.isArray(sourcedGroup.ticks)
      ? sourcedGroup.ticks
      : null;
    const baseHits =
      baseTicks?.length ||
      Math.max(1, Math.trunc(Number(sourcedGroup.hits || 1)));
    const baseCoefficient = baseTicks
      ? baseTicks.reduce((total, tick) => total + Number(tick.coefficient), 0)
      : Number(sourcedGroup.coefficient || 0);
    const damageGroup: MesmerDamageGroup = {
      ...sourcedGroup,
      ticks: undefined,
      coefficient: baseCoefficient * execution.damageMultiplier,
      hits: baseHits,
    };
    const groupName = group.name || "";
    const attackDisplayName = phantasmAttackDisplayName(
      execution.skill.id,
      groupName,
    );
    const initialEventExtra = attackDisplayName
      ? {
          name: attackDisplayName,
          parentSkillName: execution.skill.name,
        }
      : undefined;

    // Prefer per-entity measured ticks (from game recordings) over static tick arrays.
    // Measured ticks use endpoint() for absolute timestamps; fixed ticks use ms offsets.
    const measuredTicks =
      execution.timing.damageTicksByEntity?.[execution.entityIndex]?.[
        groupName
      ] ??
      (Array.isArray(execution.timing.damageTicks?.[groupName])
        ? execution.timing.damageTicks[groupName]
        : null);
    const fixedTicks = group.ticks?.length ? group.ticks : null;
    const packets = measuredTicks?.length ? measuredTicks : fixedTicks;
    const interval = Number(group.intervalMs || 0);
    let initialEvents: ReturnType<MesmerAddDamage>;

    // Branch 1: tick-packet list (measured or fixed). Coefficients split evenly across
    // hits when measured; per-packet when fixed. Wraps packets if hits > packets.length.
    if (packets?.length) {
      const hits = Math.max(1, Math.trunc(Number(damageGroup.hits || 1)));
      const timingAnchorAt = measuredTicks?.length
        ? castStart
        : group.timingAnchor === "castStart"
          ? castStart
          : at;
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
      initialEvents = addDamage(
        execution.skill,
        timingAnchorAt,
        {
          ...damageGroup,
          coefficient: undefined,
          hits: undefined,
          atMs: undefined,
          intervalMs: undefined,
          ticks,
          timingAnchor: "castStart",
          timingScale: "fixed",
        },
        initialEventExtra,
      );
    // Branch 2: interval-based multi-hit (e.g. sustained channel with regular spacing).
    } else if (interval > 0 && Number(damageGroup.hits || 1) > 1) {
      const timingAnchorAt =
        group.timingAnchor === "castStart" ? castStart : at;
      initialEvents = addDamage(
        execution.skill,
        timingAnchorAt,
        damageGroup,
        initialEventExtra,
      );
    // Branch 3: single-hit or simple multi-hit at the phantasm's damage timestamp.
    } else {
      initialEvents = addDamage(
        execution.skill,
        execution.damageAt,
        {
          ...damageGroup,
          atMs: undefined,
          intervalMs: undefined,
          timingAnchor: undefined,
          timingScale: undefined,
        },
        initialEventExtra,
      );
    }
    const initialHitTimes = initialEvents.map((event) => event.at);
    let repeatHitTimes: readonly number[] = [];
    if (execution.hasChronophantasma) {
      // Prefer dedicated Chronophantasma tick data; fall back to shifting the initial
      // hit pattern by the delta between repeatDamageAt and damageAt.
      const repeatMeasuredTicks =
        execution.timing.chronophantasmaDamageTicksByEntity?.[
          execution.entityIndex
        ]?.[groupName] ??
        execution.timing.chronophantasmaDamageTicks?.[groupName] ??
        null;
      if (repeatMeasuredTicks?.length) {
        const hits = Math.max(1, Math.trunc(Number(damageGroup.hits || 1)));
        // Chronophantasma deals 5% more damage (1.05 multiplier).
        repeatHitTimes = addDamage(
          execution.skill,
          castStart,
          {
            ...damageGroup,
            coefficient: undefined,
            hits: undefined,
            atMs: undefined,
            intervalMs: undefined,
            ticks: Array.from({ length: hits }, (_, index) => ({
              atMs:
                (execution.endpoint(
                  repeatMeasuredTicks[index % repeatMeasuredTicks.length].atMs,
                ) -
                  castStart) *
                1000,
              coefficient: Number(damageGroup.coefficient || 0) / hits,
            })),
            timingAnchor: "castStart",
            timingScale: "fixed",
          },
          {
            name: `${attackDisplayName || execution.skill.name} - Chronophantasma`,
            ...(attackDisplayName
              ? { parentSkillName: execution.skill.name }
              : {}),
            multiplier: 1.05,
          },
        ).map((event) => event.at);
      } else {
        // No dedicated repeat ticks — shift each initial hit forward by the same offset.
        const repeatOffset = execution.repeatDamageAt - execution.damageAt;
        const shiftedHitTimes = initialHitTimes.map(
          (hitAt) => hitAt + repeatOffset,
        );
        if (shiftedHitTimes.length > 0) {
          const repeatOrigin = Math.min(...shiftedHitTimes);
          repeatHitTimes = addDamage(
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
                coefficient: Number(event.coefficient || 0),
              })),
              timingAnchor: "castStart",
              timingScale: "fixed",
            },
            {
              name: `${attackDisplayName || execution.skill.name} - Chronophantasma`,
              ...(attackDisplayName
                ? { parentSkillName: execution.skill.name }
                : {}),
              multiplier: 1.05,
            },
          ).map((event) => event.at);
        }
      }
    }
    return { damageGroup, initialHitTimes, repeatHitTimes };
  };

  const scheduleConditions = (
    execution: MesmerPhantasmExecution,
    conditions: readonly MesmerConditionEffect[],
  ): void => {
    // Conditions with a phantasmEntityIndex only apply to that specific entity
    // (e.g. only the first Berserker applies vulnerability on its leap).
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
      // packetLabel ties the condition's application times to a named damage-tick sequence,
      // so conditions that apply on each hit are synchronized with the actual hit packets.
      const conditionTicks = condition.packetLabel
        ? (execution.timing.damageTicksByEntity?.[execution.entityIndex]?.[
            condition.packetLabel
          ] ??
          execution.timing.damageTicks?.[condition.packetLabel] ??
          null)
        : null;
      if (conditionTicks && conditionTicks.length > 0) {
        // Split stacks evenly across application packets.
        const packetStacks =
          Number(condition.stacks || 1) / conditionTicks.length;
        const applicationTimes = conditionTicks.map((tick) =>
          execution.endpoint(tick.atMs),
        );
        const conditionOrigin = Math.min(...applicationTimes);
        addCondition(
          execution.skill.name,
          conditionOrigin,
          {
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
          },
          "Phantasm",
          "",
          conditionEventExtra,
        );
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

    // Repeat cycle: prefer dedicated Chronophantasma tick data; fall back to shifting
    // initial tick timestamps by the delta between the two damage windows.
    const repeatOffset = execution.repeatDamageAt - execution.damageAt;
    for (const effect of entityConditions) {
      const condition = { ...effect, name: effect.condition };
      const initialConditionTicks = condition.packetLabel
        ? (execution.timing.damageTicksByEntity?.[execution.entityIndex]?.[
            condition.packetLabel
          ] ??
          execution.timing.damageTicks?.[condition.packetLabel] ??
          null)
        : null;
      const repeatConditionTicks = condition.packetLabel
        ? (execution.timing.chronophantasmaDamageTicksByEntity?.[
            execution.entityIndex
          ]?.[condition.packetLabel] ??
          execution.timing.chronophantasmaDamageTicks?.[
            condition.packetLabel
          ] ??
          null)
        : null;
      // Use repeat-specific ticks if available; otherwise fall back to shifted initial ticks.
      const conditionTicks = repeatConditionTicks ?? initialConditionTicks;
      if (conditionTicks && conditionTicks.length > 0) {
        const packetStacks =
          Number(condition.stacks || 1) / conditionTicks.length;
        const applicationTimes = conditionTicks.map((tick) =>
          repeatConditionTicks
            ? execution.endpoint(tick.atMs)
            : execution.endpoint(tick.atMs) + repeatOffset,
        );
        const conditionOrigin = Math.min(...applicationTimes);
        addCondition(
          execution.skill.name,
          conditionOrigin,
          {
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
          },
          "Phantasm",
          `${execution.skill.name} - Chronophantasma`,
          conditionEventExtra,
        );
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
    // epsilon offset ensures conversion resolves after any same-timestamp damage events.
    if (execution.virtuosoBladeAt != null) {
      // Virtuoso: blade arrives at a measured per-phantasm tick time, not the spawn time.
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
