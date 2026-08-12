import { ENGINEER_CORE_SKILL_MECHANICS } from "../../professions/engineer/core/skills.js";
import { ENGINEER_TRAIT_IDS } from "../../professions/engineer/data/ids.js";
import { EVTC_STATE_CHANGE } from "../types.js";
import type { EvtcAnalysisContext } from "../context.js";
import type {
  AttributionStatus,
  ParsedEvtcEvent,
  ProfessionAnalysisResult,
  ProfessionAnalysisSection,
} from "../types.js";
import type { EvtcProfessionAnalyzer } from "./contract.js";

const BLEEDING_BUFF_ID = 736;
const PROC_WINDOW_MS = 50;
const DIRECT_SIGNAL_WINDOW_MS = 100;

// Shrapnel and Serrated Steel both apply 1-stack Bleeding at distinct base
// durations, so EVTC only records the shared Bleeding buff (736) and never the
// causing trait. Attribution therefore relies on trigger population (explosion
// hits vs. critical hits), duration signature, and separation from direct
// Necromancer-style skill Bleeding, exactly like the Barbed Precision analyzer.
interface ProcDefinition {
  readonly id: string;
  readonly title: string;
  readonly traitId: number;
  readonly chance: number;
  readonly baseDurationSeconds: number;
  // Duration the trait guarantees on its own Bleeding when equipped (Serrated
  // Steel adds +33% to every Bleed it inflicts, including its own).
  readonly inherentDurationMultiplier: number;
  readonly triggerLabel: string;
}

type EffectLike = {
  readonly type?: string;
  readonly condition?: string;
  readonly ticks?: readonly { readonly condition?: string }[];
  readonly metadata?: { readonly damageKind?: string };
};

function effectsOf(skill: unknown): readonly EffectLike[] {
  return (skill as { readonly effects?: readonly EffectLike[] }).effects || [];
}

function appliesBleeding(effect: EffectLike): boolean {
  if (effect.type !== "condition") return false;
  if (effect.condition === "Bleeding") return true;
  return (effect.ticks || []).some((tick) => tick.condition === "Bleeding");
}

function isExplosionStrike(effect: EffectLike): boolean {
  return (
    effect.type === "strike" && effect.metadata?.damageKind === "explosion"
  );
}

function skillIdSet(predicate: (effect: EffectLike) => boolean): Set<number> {
  const ids = new Set<number>();
  for (const [skillId, skill] of Object.entries(ENGINEER_CORE_SKILL_MECHANICS)) {
    const numericId = Number(skillId);
    if (Number.isFinite(numericId) && effectsOf(skill).some(predicate)) {
      ids.add(numericId);
    }
  }
  return ids;
}

const DIRECT_BLEEDING_SKILLS = skillIdSet(appliesBleeding);
const EXPLOSION_SKILLS = skillIdSet(isExplosionStrike);

function near(
  events: readonly ParsedEvtcEvent[],
  event: ParsedEvtcEvent,
  windowMs: number,
): readonly ParsedEvtcEvent[] {
  return events.filter(
    (candidate) =>
      candidate.target === event.target &&
      Math.abs(candidate.time - event.time) <= windowMs,
  );
}

interface ProcClassification {
  readonly section: ProfessionAnalysisSection;
  readonly warnings: readonly string[];
}

function classifyBleedingProc(
  proc: ProcDefinition,
  triggers: readonly ParsedEvtcEvent[],
  bleeding: readonly ParsedEvtcEvent[],
  directSignals: readonly ParsedEvtcEvent[],
  competingProc: ProcDefinition,
  competingTriggers: readonly ParsedEvtcEvent[],
): ProcClassification {
  const exactDurationMs =
    proc.baseDurationSeconds * 1000 * proc.inherentDurationMultiplier;
  const minimumDurationMs =
    proc.baseDurationSeconds * 1000 * proc.inherentDurationMultiplier - 100;
  const maximumDurationMs = proc.baseDurationSeconds * 1000 * 2 + 100;
  const competingLo =
    competingProc.baseDurationSeconds *
      1000 *
      competingProc.inherentDurationMultiplier -
    100;
  const competingHi = competingProc.baseDurationSeconds * 1000 * 2 + 100;
  const inBand = (value: number): boolean =>
    value >= minimumDurationMs && value <= maximumDurationMs;
  const inCompetingBand = (value: number): boolean =>
    value >= competingLo && value <= competingHi;

  // Derive a stable observed duration cohort so unlogged expertise, runes, and
  // food that scale the Bleed duration are learned from the log instead of
  // assumed, mirroring the Barbed Precision derivation.
  const cleanCandidates = bleeding.filter(
    (application) =>
      inBand(application.value) &&
      !inCompetingBand(application.value) &&
      near(directSignals, application, DIRECT_SIGNAL_WINDOW_MS).length === 0 &&
      near(triggers, application, PROC_WINDOW_MS).length > 0,
  );
  const durationCounts = new Map<number, number>();
  for (const application of cleanCandidates) {
    durationCounts.set(
      application.value,
      (durationCounts.get(application.value) || 0) + 1,
    );
  }
  const [modalDuration, modalDurationCount = 0] = [...durationCounts].sort(
    (left, right) => right[1] - left[1] || left[0] - right[0],
  )[0] || [0, 0];
  const derivedDurationMs =
    modalDurationCount >= 3 &&
    modalDurationCount / Math.max(1, cleanCandidates.length) >= 0.75
      ? modalDuration
      : null;

  const preliminary = new Map<
    ParsedEvtcEvent,
    {
      readonly kind: AttributionStatus;
      readonly triggers: readonly ParsedEvtcEvent[];
    }
  >();
  let excludedDirectApplications = 0;
  let excludedUncorrelatedApplications = 0;
  let excludedOutOfBandApplications = 0;
  for (const application of bleeding) {
    const matchesDerived =
      derivedDurationMs !== null &&
      Math.abs(application.value - derivedDurationMs) <= 100;
    if (!inBand(application.value) && !matchesDerived) {
      excludedOutOfBandApplications += 1;
      continue;
    }
    if (
      near(directSignals, application, DIRECT_SIGNAL_WINDOW_MS).length &&
      !matchesDerived
    ) {
      excludedDirectApplications += 1;
      continue;
    }
    const possibleTriggers = near(triggers, application, PROC_WINDOW_MS);
    if (!possibleTriggers.length) {
      excludedUncorrelatedApplications += 1;
      continue;
    }
    // A duration that also fits the other proc's band, with that proc's trigger
    // present too, cannot be attributed to one trait over the other, so it is
    // bounded instead of counted.
    if (
      inCompetingBand(application.value) &&
      near(competingTriggers, application, PROC_WINDOW_MS).length
    ) {
      preliminary.set(application, {
        kind: "ambiguous",
        triggers: possibleTriggers,
      });
      continue;
    }
    const durationDifference = Math.abs(application.value - exactDurationMs);
    preliminary.set(application, {
      kind:
        durationDifference <= 100
          ? "exact"
          : matchesDerived
            ? "inferred"
            : "ambiguous",
      triggers: possibleTriggers,
    });
  }

  // Multiple applications sharing one trigger cannot all be procs of that
  // trigger, so collapse them to a single bounded proc.
  const byTrigger = new Map<ParsedEvtcEvent, ParsedEvtcEvent[]>();
  for (const [application, candidate] of preliminary) {
    if (candidate.kind === "ambiguous" || candidate.triggers.length !== 1) {
      continue;
    }
    const trigger = candidate.triggers[0];
    const matches = byTrigger.get(trigger) || [];
    matches.push(application);
    byTrigger.set(trigger, matches);
  }
  let exact = 0;
  let inferred = 0;
  let ambiguousEvents = 0;
  let ambiguousMaximum = 0;
  const groupedApplications = new Set<ParsedEvtcEvent>();
  for (const matches of byTrigger.values()) {
    if (matches.length <= 1) continue;
    ambiguousEvents += matches.length;
    ambiguousMaximum += 1;
    matches.forEach((application) => groupedApplications.add(application));
  }
  for (const [application, candidate] of preliminary) {
    if (groupedApplications.has(application)) continue;
    if (candidate.kind === "exact") exact += 1;
    else if (candidate.kind === "inferred") inferred += 1;
    else {
      ambiguousEvents += 1;
      ambiguousMaximum += 1;
    }
  }
  const classified = exact + inferred;
  const minimumPossible = classified;
  const maximumPossible = exact + inferred + ambiguousMaximum;
  const status: AttributionStatus = ambiguousEvents
    ? "ambiguous"
    : inferred
      ? "inferred"
      : "exact";
  const observedCandidateCount =
    status === "ambiguous"
      ? `${minimumPossible}–${maximumPossible}`
      : classified;
  const expected = triggers.length * proc.chance;
  const formatRate = (count: number): string =>
    `${((count / triggers.length) * 100).toFixed(2)}%`;
  const observedRate = triggers.length
    ? status === "ambiguous"
      ? `${formatRate(minimumPossible)}–${formatRate(maximumPossible)}`
      : formatRate(classified)
    : `Not applicable (no eligible ${proc.triggerLabel})`;
  const formatDifference = (count: number): string => {
    const difference = count - expected;
    return `${difference > 0 ? "+" : ""}${difference.toFixed(2)} procs`;
  };
  const differenceFromExpectation =
    status === "ambiguous"
      ? `${formatDifference(minimumPossible)} to ${formatDifference(maximumPossible)}`
      : formatDifference(classified);
  const explicitApplications = bleeding.filter(
    (event) => event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY,
  ).length;

  return {
    section: {
      id: proc.id,
      title: proc.title,
      status,
      fields: [
        { label: "Trait ID", value: proc.traitId },
        { label: "Applicable proc chance", value: `${proc.chance * 100}%` },
        {
          label: `Eligible ${proc.triggerLabel}`,
          value: triggers.length,
        },
        {
          label: "Expected procs if equipped",
          value: Number(expected.toFixed(2)),
        },
        { label: "Observed candidate procs", value: observedCandidateCount },
        { label: "Minimum possible procs", value: minimumPossible },
        { label: "Maximum possible procs", value: maximumPossible },
        { label: "Observed proc rate", value: observedRate },
        {
          label: "Difference from expectation",
          value: differenceFromExpectation,
        },
        { label: "Ambiguous events", value: ambiguousEvents },
      ],
      evidence: [
        `${triggers.length} player-originated ${proc.triggerLabel} against the recognized golem.`,
        `${bleeding.length} outgoing Bleeding applications (${explicitApplications} explicit CBTS_BUFFAPPLY, ${bleeding.length - explicitApplications} legacy).`,
        `${excludedDirectApplications} applications excluded by known direct Engineer Bleeding skills.`,
        `${excludedUncorrelatedApplications} applications excluded because no eligible ${proc.triggerLabel.replace(/s$/, "")} occurred within ${PROC_WINDOW_MS} ms.`,
        `${excludedOutOfBandApplications} applications excluded because their duration fell outside the ${(minimumDurationMs / 1000).toFixed(1)}–${(maximumDurationMs / 1000).toFixed(1)}s ${proc.title} band.`,
        ...(derivedDurationMs === null
          ? []
          : [
              `A stable ${(derivedDurationMs / 1000).toFixed(1)}s candidate duration was derived from ${modalDurationCount} non-conflicting applications and used to separate ${proc.title} from direct-skill Bleeding.`,
            ]),
        `Candidate duration compared with the ${proc.baseDurationSeconds}s base duration${proc.inherentDurationMultiplier > 1 ? ` plus ${proc.title}'s own +${Math.round((proc.inherentDurationMultiplier - 1) * 100)}% Bleeding duration` : ""}.`,
      ],
      assumptions: [
        `EVTC does not prove that the ${proc.title} trait was equipped; every expected value is conditional on the trait being active.`,
        "Bleeding applications record only the shared condition buff, so Shrapnel and Serrated Steel are separated by trigger type and duration rather than a labeled source.",
        "Overlapping durations, multiple applications matched to one trigger, and unlogged duration modifiers are bounded instead of being counted as procs.",
      ],
    },
    warnings: [
      `${proc.title} causality is not directly labeled in EVTC; attribution is based on trigger type, timing, target, duration, and known conflicting skills.`,
    ],
  };
}

const SHRAPNEL: ProcDefinition = Object.freeze({
  id: "engineer.shrapnel",
  title: "Shrapnel",
  traitId: ENGINEER_TRAIT_IDS.SHRAPNEL,
  chance: 0.33,
  baseDurationSeconds: 6,
  inherentDurationMultiplier: 1,
  triggerLabel: "explosion hits",
});

const SERRATED_STEEL: ProcDefinition = Object.freeze({
  id: "engineer.serrated-steel",
  title: "Serrated Steel",
  traitId: ENGINEER_TRAIT_IDS.SERRATED_STEEL,
  chance: 0.33,
  baseDurationSeconds: 3,
  inherentDurationMultiplier: 1.33,
  triggerLabel: "critical hits",
});

function analyzeEngineerBleedProcs(
  context: EvtcAnalysisContext,
): ProfessionAnalysisResult {
  const strikes = context.log.events.filter(
    (event) =>
      context.isSelectedPlayerSource(event) &&
      context.isDamageToTarget(event) &&
      event.buff === 0 &&
      event.value > 0,
  );
  const criticals = strikes.filter((event) => event.result === 1);
  const explosionHits = strikes.filter((event) =>
    EXPLOSION_SKILLS.has(event.skillId),
  );
  const bleeding = context.log.events.filter(
    (event) =>
      context.isSelectedPlayerSource(event) &&
      event.target === context.targetAddress &&
      event.buff === 1 &&
      event.buffRemove === 0 &&
      event.value > 0 &&
      (event.stateChange === EVTC_STATE_CHANGE.NONE ||
        event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY) &&
      (event.skillId === BLEEDING_BUFF_ID ||
        context.skillName(event.skillId) === "Bleeding"),
  );
  const directSignals = context.log.events.filter(
    (event) =>
      context.isSelectedPlayerSource(event) &&
      event.target === context.targetAddress &&
      DIRECT_BLEEDING_SKILLS.has(event.skillId) &&
      (event.activation !== 0 || event.value > 0),
  );

  const shrapnel = classifyBleedingProc(
    SHRAPNEL,
    explosionHits,
    bleeding,
    directSignals,
    SERRATED_STEEL,
    criticals,
  );
  const serrated = classifyBleedingProc(
    SERRATED_STEEL,
    criticals,
    bleeding,
    directSignals,
    SHRAPNEL,
    explosionHits,
  );

  return {
    analyzerId: "engineer",
    sections: [shrapnel.section, serrated.section],
    warnings: [...shrapnel.warnings, ...serrated.warnings],
  };
}

export const engineerEvtcAnalyzer: EvtcProfessionAnalyzer = Object.freeze({
  id: "engineer",
  professionId: "engineer",
  analyze: analyzeEngineerBleedProcs,
});
