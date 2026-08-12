import { EvtcError } from "./errors.js";
import { addressHex } from "./player-detection.js";
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from "./types.js";
import type {
  BuffApplicationSummary,
  CastSummary,
  DamageRollDistribution,
  GenericEvtcStatistics,
  SkillDamageSummary,
} from "./types.js";
import type { EvtcAnalysisContext } from "./context.js";

const CONDITION_NAMES = new Set([
  "Bleeding",
  "Blindness",
  "Burning",
  "Chilled",
  "Confusion",
  "Crippled",
  "Fear",
  "Immobilized",
  "Poisoned",
  "Slow",
  "Torment",
  "Vulnerability",
  "Weakness",
]);

function distribution(
  values: readonly number[],
): DamageRollDistribution | null {
  if (!values.length) return null;
  const samples = [...values].sort((left, right) => left - right);
  const average =
    samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return {
    count: samples.length,
    minimum: samples[0],
    maximum: samples[samples.length - 1],
    average,
    samples,
    normalizedToMean: samples.map((value) =>
      Number((value / average).toFixed(6)),
    ),
  };
}

export function analyzeGenericCombat(
  context: EvtcAnalysisContext,
): GenericEvtcStatistics {
  interface MutableSkill {
    skillId: number;
    skillName: string;
    connectedHits: number;
    criticalHits: number;
    nonCriticalHits: number;
    strikeDamage: number;
    conditionDamage: number;
    criticalRolls: number[];
    nonCriticalRolls: number[];
  }
  const skills = new Map<number, MutableSkill>();
  const damageTimes: number[] = [];
  let strikeDamage = 0;
  let conditionDamage = 0;
  let connectedHits = 0;
  let criticalHits = 0;
  for (const event of context.log.events) {
    if (
      !context.isPlayerOwnedSource(event) ||
      !context.isDamageToTarget(event)
    ) {
      continue;
    }
    const strike = event.buff === 0 ? Math.max(0, event.value) : 0;
    const condition = event.buff === 1 ? Math.max(0, event.buffDamage) : 0;
    if (!strike && !condition) continue;
    damageTimes.push(event.time);
    const current = skills.get(event.skillId) || {
      skillId: event.skillId,
      skillName: context.skillName(event.skillId),
      connectedHits: 0,
      criticalHits: 0,
      nonCriticalHits: 0,
      strikeDamage: 0,
      conditionDamage: 0,
      criticalRolls: [],
      nonCriticalRolls: [],
    };
    current.strikeDamage += strike;
    current.conditionDamage += condition;
    strikeDamage += strike;
    conditionDamage += condition;
    if (strike > 0) {
      current.connectedHits += 1;
      connectedHits += 1;
      if (event.result === 1) {
        current.criticalHits += 1;
        current.criticalRolls.push(strike);
        criticalHits += 1;
      } else {
        current.nonCriticalHits += 1;
        current.nonCriticalRolls.push(strike);
      }
    }
    skills.set(event.skillId, current);
  }
  if (!damageTimes.length) {
    throw new EvtcError(
      "NO_PLAYER_DAMAGE",
      "The selected player dealt no damage to the recognized golem.",
    );
  }
  const startTime = Math.min(...damageTimes);
  const endTime = Math.max(...damageTimes);
  if (endTime <= startTime) {
    throw new EvtcError(
      "UNUSABLE_INTERVAL",
      "The log does not contain a usable combat interval.",
    );
  }
  const perSkill: SkillDamageSummary[] = [...skills.values()]
    .map((skill) => ({
      skillId: skill.skillId,
      skillName: skill.skillName,
      connectedHits: skill.connectedHits,
      criticalHits: skill.criticalHits,
      nonCriticalHits: skill.nonCriticalHits,
      strikeDamage: skill.strikeDamage,
      conditionDamage: skill.conditionDamage,
      criticalDamageRolls: distribution(skill.criticalRolls),
      nonCriticalDamageRolls: distribution(skill.nonCriticalRolls),
    }))
    .sort(
      (left, right) =>
        right.strikeDamage +
        right.conditionDamage -
        left.strikeDamage -
        left.conditionDamage,
    );

  const castsBySkill = new Map<number, { timestamps: number[] }>();
  const swaps: GenericEvtcStatistics["weaponSwaps"][number][] = [];
  interface MutableApplication {
    skillId: number;
    skillName: string;
    kind: BuffApplicationSummary["kind"];
    source: string;
    target: string;
    applications: number;
    totalDurationMs: number;
    timestampsMs: number[];
  }
  const applications = new Map<string, MutableApplication>();
  for (const event of context.log.events) {
    // Count one action per skill cast. Current arcdps builds log casts as
    // CBTS_ANIMATION_START/STOP state changes; older builds emit a plain
    // activation event (stateChange NONE) whose CANCEL_FIRE marks the cast
    // reaching tooltip time. A build uses one encoding or the other, so
    // accepting both cannot double-count. Anchoring on the start keeps the
    // recorded timestamp at the moment the cast began.
    const isPlayerCast =
      context.isSelectedPlayerSource(event) &&
      (event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START ||
        (event.stateChange === EVTC_STATE_CHANGE.NONE &&
          event.activation === EVTC_ACTIVATION.CANCEL_FIRE &&
          event.value > 0));
    if (isPlayerCast) {
      const cast = castsBySkill.get(event.skillId) || { timestamps: [] };
      cast.timestamps.push(event.time - startTime);
      castsBySkill.set(event.skillId, cast);
    }
    if (
      context.isSelectedPlayerSource(event) &&
      event.stateChange === EVTC_STATE_CHANGE.WEAPON_SWAP
    ) {
      const rawSet = Number(event.target);
      swaps.push({
        timestampMs: event.time - startTime,
        weaponSet: Number.isSafeInteger(rawSet) && rawSet > 0 ? rawSet : null,
      });
    }
    if (
      !context.isPlayerOwnedSource(event) ||
      event.buff !== 1 ||
      event.buffRemove !== 0 ||
      event.activation !== 0 ||
      event.value <= 0 ||
      (event.stateChange !== EVTC_STATE_CHANGE.NONE &&
        event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY)
    ) {
      continue;
    }
    const skillName = context.skillName(event.skillId);
    const source = addressHex(event.source);
    const target = addressHex(event.target);
    const key = `${event.skillId}:${source}:${target}`;
    const current = applications.get(key) || {
      skillId: event.skillId,
      skillName,
      kind: CONDITION_NAMES.has(skillName) ? "condition" : "buff",
      source,
      target,
      applications: 0,
      totalDurationMs: 0,
      timestampsMs: [],
    };
    current.applications += 1;
    current.totalDurationMs += event.value;
    current.timestampsMs.push(event.time - startTime);
    applications.set(key, current);
  }
  const casts: CastSummary[] = [...castsBySkill]
    .map(([skillId, cast]) => ({
      skillId,
      skillName: context.skillName(skillId),
      count: cast.timestamps.length,
      timestampsMs: cast.timestamps,
    }))
    .sort((left, right) => right.count - left.count);

  const castCount = casts.reduce((sum, cast) => sum + cast.count, 0);
  const durationMinutes = (endTime - startTime) / 60_000;
  const roundApm = (actions: number): number =>
    Number((actions / durationMinutes).toFixed(2));

  return {
    startTime,
    endTime,
    combatDurationMs: endTime - startTime,
    totalOutgoingStrikeDamage: strikeDamage,
    totalOutgoingConditionDamage: conditionDamage,
    connectedStrikeHits: connectedHits,
    criticalHits,
    nonCriticalHits: connectedHits - criticalHits,
    criticalHitRate: connectedHits ? criticalHits / connectedHits : null,
    perSkill,
    casts,
    actionsPerMinute: {
      castCount,
      weaponSwapCount: swaps.length,
      totalActions: castCount + swaps.length,
      durationMs: endTime - startTime,
      castApm: roundApm(castCount),
      apm: roundApm(castCount + swaps.length),
    },
    weaponSwaps: swaps,
    weaponSets: {
      status: "unavailable",
      reason:
        "EVTC weapon-swap events do not identify equipped weapon types reliably.",
    },
    outgoingApplications: [...applications.values()].sort(
      (left, right) => right.applications - left.applications,
    ),
    weaponStrength: {
      status: "unavailable",
      missingInputs: [
        "skill coefficient",
        "player Power",
        "target armor",
        "applicable damage modifiers",
        "critical multiplier",
        "damage type guarantees",
      ],
      note: "Reported rolls are observed final-damage values. No build attributes or modifiers are assumed.",
    },
  };
}
