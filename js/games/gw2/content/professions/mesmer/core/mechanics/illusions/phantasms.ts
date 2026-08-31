import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import { phantasmalHasteSpeed, triggerCompoundingPower } from '#gw2/content/professions/mesmer/core/traits/index.js';
import type {
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerConditionEffect,
  MesmerDamageGroup,
  MesmerPhantasmAttackTiming,
  MesmerPhantasmPolicy,
  MesmerQueueResources,
  MesmerRuntime,
  MesmerSkill,
  MesmerStrikeEffect
} from '#gw2/content/professions/mesmer/types.js';

export interface MesmerPhantasmExecution {
  readonly skill: MesmerSkill;
  // Index among co-spawned entities (e.g. Bountiful Blades spawns 2 Berserkers: 0 and 1).
  readonly entityIndex: number;
  // Scales coefficient down when multiple phantasms share a skill's total damage budget (Bountiful Blades: 0.66).
  readonly damageMultiplier: number;
  readonly summonAt: number;
  readonly damageAt: number;
  // When a specialization repeat policy re-summons the phantasm; equals damageAt otherwise.
  readonly spawnAt: number;
  // Timestamp for the optional repeat attack.
  readonly repeatDamageAt: number;
  // When the phantasm converts to a blade/resource. Equals spawnAt normally;
  // equals the specialization-authored re-spawn time when repeat is active.
  readonly conversionAt: number;
  // When a specialization bonus strike fires; uses a post-spawn delay when supplied.
  readonly initialBladeAt: number;
  readonly hasRepeat: boolean;
  // Optional specialization policy override for the generic conversion timestamp.
  readonly resourceAtOverride: number | null;
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
    clarityConsumed: boolean
  ): readonly MesmerPhantasmExecution[];
  scheduleLifecycle(executions: readonly MesmerPhantasmExecution[]): void;
  scheduleStrike(
    execution: MesmerPhantasmExecution,
    group: MesmerStrikeEffect,
    selectedGroup: MesmerDamageGroup,
    castStart: number
  ): MesmerPhantasmStrikeResult;
  scheduleConditions(execution: MesmerPhantasmExecution, conditions: readonly MesmerConditionEffect[]): void;
  queueConversion(execution: MesmerPhantasmExecution, amount?: number): void;
}

interface PhantasmEffectControllerOptions {
  readonly traits: ReadonlySet<number>;
  readonly phantasmAttackTimings: Readonly<Record<number, MesmerPhantasmAttackTiming>>;
  readonly phantasmPolicy: () => MesmerPhantasmPolicy;
  readonly epsilon: number;
  readonly queueResources: MesmerQueueResources;
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly addCondition: MesmerAddCondition;
  readonly addDamage: MesmerAddDamage;
  readonly balanceProfile: MesmerRuntime['balanceProfile'];
}

function phantasmAttackDisplayName(skillId: number, damageGroupName: string): string {
  if (skillId !== ID.PHANTASMAL_SWORDSMAN) return '';
  if (damageGroupName === 'Phantasm leap') return 'Sword Attack';
  if (damageGroupName === 'Phantasm Blurred Frenzy') return 'Blurred Frenzy';
  return '';
}

export function createPhantasmEffectController({
  traits,
  phantasmAttackTimings,
  phantasmPolicy,
  epsilon,
  queueResources,
  addEvent,
  addTraitProc,
  addCondition,
  addDamage,
  balanceProfile
}: PhantasmEffectControllerOptions): MesmerPhantasmEffectController {
  const prepare = (
    skill: MesmerSkill,
    castStart: number,
    summonAt: number,
    clarityConsumed: boolean
  ): readonly MesmerPhantasmExecution[] => {
    if (skill.resource?.mode !== 'phantasm') return [];

    // Clarity (Herald legend) doubles Lancer's phantasm count when consumed on cast.
    const policy = phantasmPolicy();
    const spawnModifier = policy.spawnModifiers[skill.id];
    const count =
      Number(skill.resource.count || 1) *
      (skill.id === ID.PHANTASMAL_LANCER && clarityConsumed ? 2 : 1) *
      Number(spawnModifier?.countMultiplier || 1);

    const timing = phantasmAttackTimings[skill.id];
    if (!timing) {
      throw new TypeError(`Phantasm skill ${skill.id} requires attack timing metadata.`);
    }

    // Phantasmal Haste compresses all post-cast timing offsets by 1/speed.
    const speed = phantasmalHasteSpeed({ traits, balanceProfile });
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
        skill,
        entityIndex,
        damageMultiplier: Number(spawnModifier?.damageMultiplier || 1),
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
            ? spawnAt + Number(timing.phantasmalBladeDelayAfterSpawnMs) / 1000
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

  const addBonusStrike = (execution: MesmerPhantasmExecution, at: number): void => {
    const bonus = phantasmPolicy().bonusStrike;
    if (!bonus) return;
    addDamage(
      {
        id: bonus.name,
        name: bonus.name,
        weapon: execution.skill.weapon,
        blade: true
      },
      at,
      {
        coefficient: bonus.damage.coefficient,
        hits: bonus.damage.hits,
        source: 'Player',
        weaponStrength: bonus.damage.weaponStrength
      }
    );
  };

  const scheduleLifecycle = (executions: readonly MesmerPhantasmExecution[]): void => {
    const execution = executions[0];
    if (!execution) return;
    const { skill } = execution;
    const count = executions.length;
    const policy = phantasmPolicy();

    // Lifecycle events use the latest entity's timestamp so the "complete" marker
    // fires after every entity in the batch has finished attacking.
    const damageAt = Math.max(...executions.map((item) => item.damageAt));
    const repeatDamageAt = Math.max(...executions.map((item) => item.repeatDamageAt));
    const initialBladeAt = Math.max(...executions.map((item) => item.initialBladeAt));

    triggerCompoundingPower(
      { traits, epsilon, addEvent, addTraitProc, balanceProfile },
      execution.summonAt,
      count,
      skill.name,
      `${count} phantasm${count === 1 ? '' : 's'}`
    );

    addEvent({
      type: 'mesmer.phantasm-summoned',
      at: execution.summonAt,
      name: skill.name,
      count
    });
    addEvent({
      type: 'mesmer.phantasm-attack',
      at: damageAt,
      name: skill.name,
      count,
      repeat: false,
      complete: true
    });
    if (policy.bonusStrike) {
      // Each entity fires its specialization-defined bonus strike at its own initial timestamp.
      for (const item of executions) {
        addBonusStrike(item, item.initialBladeAt);
      }

      addTraitProc(policy.bonusStrike.traitName, initialBladeAt, skill.name);
    }

    if (!execution.hasRepeat || !policy.repeat) return;

    // The active specialization repeat policy re-summons the phantasm for a second attack cycle.
    triggerCompoundingPower(
      { traits, epsilon, addEvent, addTraitProc, balanceProfile },
      execution.spawnAt,
      count,
      `${skill.name} - ${policy.repeat.label}`,
      `${count} phantasm${count === 1 ? '' : 's'}`
    );

    addEvent({
      type: 'mesmer.phantasm-resummoned',
      at: execution.spawnAt,
      name: skill.name,
      count
    });
    addEvent({
      type: 'mesmer.phantasm-attack',
      at: repeatDamageAt,
      name: skill.name,
      count,
      repeat: true,
      complete: true
    });
    if (policy.bonusStrike) {
      for (const item of executions) {
        addBonusStrike(item, item.repeatDamageAt);
      }

      addTraitProc(policy.bonusStrike.traitName, repeatDamageAt, `${skill.name} - ${policy.repeat.label}`);
    }

    addTraitProc(policy.repeat.traitName, execution.spawnAt, skill.name);
  };

  const scheduleStrike = (
    execution: MesmerPhantasmExecution,
    group: MesmerStrikeEffect,
    selectedGroup: MesmerDamageGroup,
    castStart: number
  ): MesmerPhantasmStrikeResult => {
    const sourcedGroup: MesmerDamageGroup = {
      ...selectedGroup,
      source: 'Phantasm',
      actorType: 'summon',
      summonKind: 'phantasm'
    };
    const baseTicks = sourcedGroup.ticks?.length ? sourcedGroup.ticks : null;
    const damageGroup: MesmerDamageGroup = {
      ...sourcedGroup,
      ...(baseTicks
        ? {
            coefficient: undefined,
            hits: undefined,
            ticks: baseTicks.map((tick) => ({
              ...tick,
              coefficient: Number(tick.coefficient) * execution.damageMultiplier
            }))
          }
        : { coefficient: Number(sourcedGroup.coefficient || 0) * execution.damageMultiplier })
    };
    const groupName = group.name || '';
    const attackDisplayName = phantasmAttackDisplayName(execution.skill.id, groupName);
    const initialEventExtra = attackDisplayName
      ? {
          name: attackDisplayName,
          parentSkillName: execution.skill.name
        }
      : undefined;

    // Measured phantasm timings position the authored damage packets without changing their formulas.
    const measuredTicks =
      execution.timing.damageTicksByEntity?.[execution.entityIndex]?.[groupName] ??
      (Array.isArray(execution.timing.damageTicks?.[groupName]) ? execution.timing.damageTicks[groupName] : null);
    const fixedTicks = damageGroup.ticks?.length ? damageGroup.ticks : null;
    let initialEvents: ReturnType<MesmerAddDamage>;

    if (measuredTicks?.length) {
      const coefficients = fixedTicks?.map((tick) => Number(tick.coefficient)) ?? [
        Number(damageGroup.coefficient || 0)
      ];
      if (measuredTicks.length !== coefficients.length) {
        throw new TypeError(
          `Phantasm strike ${execution.skill.id} packet count does not match its measured timing metadata.`
        );
      }
      initialEvents = addDamage(
        execution.skill,
        castStart,
        {
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
        },
        initialEventExtra
      );
    } else if (fixedTicks?.length) {
      initialEvents = addDamage(
        execution.skill,
        castStart,
        {
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
        },
        initialEventExtra
      );
    } else {
      initialEvents = addDamage(
        execution.skill,
        damageGroup.atMs == null ? execution.damageAt : execution.endpoint(damageGroup.atMs),
        {
          ...damageGroup,
          atMs: undefined,
          intervalMs: undefined,
          timingAnchor: undefined,
          timingScale: undefined
        },
        initialEventExtra
      );
    }

    const initialHitTimes = initialEvents.map((event) => event.at);
    let repeatHitTimes: readonly number[] = [];
    if (execution.hasRepeat) {
      const repeatPolicy = phantasmPolicy().repeat;
      if (!repeatPolicy) return { damageGroup, initialHitTimes, repeatHitTimes };
      // Prefer dedicated repeat tick data; fall back to shifting the initial
      // hit pattern by the delta between repeatDamageAt and damageAt.
      const repeatMeasuredTicks =
        execution.timing.repeatDamageTicksByEntity?.[execution.entityIndex]?.[groupName] ??
        execution.timing.repeatDamageTicks?.[groupName] ??
        null;
      if (repeatMeasuredTicks?.length) {
        const coefficients = fixedTicks?.map((tick) => Number(tick.coefficient)) ?? [
          Number(damageGroup.coefficient || 0)
        ];
        if (repeatMeasuredTicks.length !== coefficients.length) {
          throw new TypeError(
            `Phantasm strike ${execution.skill.id} packet count does not match its measured repeat timing metadata.`
          );
        }
        repeatHitTimes = addDamage(
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
            name: `${attackDisplayName || execution.skill.name} - ${repeatPolicy.label}`,
            ...(attackDisplayName ? { parentSkillName: execution.skill.name } : {}),
            multiplier: repeatPolicy.damageMultiplier
          }
        ).map((event) => event.at);
      } else {
        // No dedicated repeat ticks — shift each initial hit forward by the same offset.
        const repeatOffset = execution.repeatDamageAt - execution.damageAt;
        const shiftedHitTimes = initialHitTimes.map((hitAt) => hitAt + repeatOffset);
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
                coefficient: Number(event.coefficient || 0)
              })),
              timingAnchor: 'castStart',
              timingScale: 'fixed'
            },
            {
              name: `${attackDisplayName || execution.skill.name} - ${repeatPolicy.label}`,
              ...(attackDisplayName ? { parentSkillName: execution.skill.name } : {}),
              multiplier: repeatPolicy.damageMultiplier
            }
          ).map((event) => event.at);
        }
      }
    }

    return { damageGroup, initialHitTimes, repeatHitTimes };
  };

  const scheduleConditions = (
    execution: MesmerPhantasmExecution,
    conditions: readonly MesmerConditionEffect[]
  ): void => {
    // Conditions with a phantasmEntityIndex only apply to that specific entity
    // (e.g. only the first Berserker applies vulnerability on its leap).
    const entityConditions = conditions.filter(
      (effect) => effect.phantasmEntityIndex == null || effect.phantasmEntityIndex === execution.entityIndex
    );
    const conditionEventExtra = {
      source: 'Phantasm',
      sourceId: execution.skill.id,
      skillId: execution.skill.id,
      actorType: 'summon' as const,
      summonKind: 'phantasm' as const
    };
    const authoredDamageTicks = (label: string) =>
      execution.skill.effects?.find(
        (candidate): candidate is MesmerStrikeEffect => candidate.type === 'strike' && candidate.name === label
      )?.ticks;
    for (const effect of entityConditions) {
      const condition = { ...effect, name: effect.condition };
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
        const packetStacks = Number(condition.stacks || 1) / conditionTicks.length;
        const applicationTimes = conditionTicks.map((tick) => execution.endpoint(tick.atMs));
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
              stacks: packetStacks
            })),
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          },
          'Phantasm',
          '',
          conditionEventExtra
        );
      } else {
        addCondition(execution.skill.name, execution.damageAt, condition, 'Phantasm', '', conditionEventExtra);
      }
    }

    if (!execution.hasRepeat || entityConditions.length === 0) return;
    const repeatPolicy = phantasmPolicy().repeat;
    if (!repeatPolicy) return;

    // Repeat cycle: prefer dedicated repeat tick data; fall back to shifting
    // initial tick timestamps by the delta between the two damage windows.
    const repeatOffset = execution.repeatDamageAt - execution.damageAt;
    for (const effect of entityConditions) {
      const condition = { ...effect, name: effect.condition };
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
        const packetStacks = Number(condition.stacks || 1) / conditionTicks.length;
        const applicationTimes = conditionTicks.map((tick) =>
          repeatConditionTicks ? execution.endpoint(tick.atMs) : execution.endpoint(tick.atMs) + repeatOffset
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
              stacks: packetStacks
            })),
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          },
          'Phantasm',
          `${execution.skill.name} - ${repeatPolicy.label}`,
          conditionEventExtra
        );
      } else {
        addCondition(
          execution.skill.name,
          execution.repeatDamageAt,
          condition,
          'Phantasm',
          `${execution.skill.name} - ${repeatPolicy.label}`,
          conditionEventExtra
        );
      }
    }
  };

  const queueConversion = (execution: MesmerPhantasmExecution, amount = 1): void => {
    // epsilon offset ensures conversion resolves after any same-timestamp damage events.
    if (execution.resourceAtOverride != null) {
      // An active specialization may align conversion to a measured per-phantasm tick.
      queueResources(
        execution.resourceAtOverride + epsilon,
        amount,
        null,
        `${execution.skill.name} phantasm conversion`,
        {
          kind: 'phantasm-conversion',
          sourceSkillId: execution.skill.id
        }
      );
      return;
    }

    queueResources(execution.conversionAt + epsilon, amount, null, `${execution.skill.name} phantasm conversion`, {
      kind: 'phantasm-conversion',
      sourceSkillId: execution.skill.id
    });
  };

  return {
    prepare,
    scheduleLifecycle,
    scheduleStrike,
    scheduleConditions,
    queueConversion
  };
}
