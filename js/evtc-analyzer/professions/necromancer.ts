import { NECROMANCER_CORE_BASE_SKILL_MECHANICS } from "../../professions/necromancer/core/skills.js";
import { NECROMANCER_CORE_MECHANICS } from "../../professions/necromancer/core/mechanics.js";
import { NECROMANCER_TRAIT_IDS } from "../../professions/necromancer/data/ids.js";
import { EVTC_STATE_CHANGE } from "../types.js";
import type { EvtcAnalysisContext } from "../context.js";
import type {
  AttributionStatus,
  ParsedEvtcEvent,
  ProfessionAnalysisResult,
} from "../types.js";
import type { EvtcProfessionAnalyzer } from "./contract.js";

const BLEEDING_BUFF_ID = 736;
const DIRECT_SIGNAL_WINDOW_MS = 100;
const PROC_WINDOW_MS = 50;
const DURATION_TOLERANCE_MS = 100;

const CONDITION_TRANSFER_SKILLS = new Set([
  10562, // Plague Signet
  10705, // Deathly Swarm
  19116, // Putrid Mark
]);

const DIRECT_BLEEDING_SKILLS = new Set(
  Object.entries(NECROMANCER_CORE_BASE_SKILL_MECHANICS)
    .filter(([, skill]) => {
      const effects = (
        skill as {
          readonly effects?: readonly {
            readonly type?: string;
            readonly condition?: string;
          }[];
        }
      ).effects;
      return effects?.some(
        (effect) =>
          effect.type === "condition" && effect.condition === "Bleeding",
      );
    })
    .map(([skillId]) => Number(skillId)),
);

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

function maximumOneToOneMatches(
  candidates: ReadonlyMap<
    ParsedEvtcEvent,
    { readonly criticals: readonly ParsedEvtcEvent[] }
  >,
): number {
  const applicationByCritical = new Map<ParsedEvtcEvent, ParsedEvtcEvent>();

  const assign = (
    application: ParsedEvtcEvent,
    visited: Set<ParsedEvtcEvent>,
  ): boolean => {
    const candidate = candidates.get(application);
    if (!candidate) return false;
    for (const critical of candidate.criticals) {
      if (visited.has(critical)) continue;
      visited.add(critical);
      const previous = applicationByCritical.get(critical);
      if (!previous || assign(previous, visited)) {
        applicationByCritical.set(critical, application);
        return true;
      }
    }
    return false;
  };

  let matches = 0;
  for (const application of candidates.keys()) {
    if (assign(application, new Set())) matches += 1;
  }
  return matches;
}

function barbedPrecisionAnalysis(
  context: EvtcAnalysisContext,
): ProfessionAnalysisResult {
  const mechanics =
    NECROMANCER_CORE_MECHANICS.traitProcs[
      NECROMANCER_TRAIT_IDS.BARBED_PRECISION
    ];
  const criticals = context.log.events.filter(
    (event) =>
      context.isSelectedPlayerSource(event) &&
      context.isDamageToTarget(event) &&
      event.buff === 0 &&
      event.value > 0 &&
      event.result === 1,
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
  const transferSignals = context.log.events.filter(
    (event) =>
      context.isSelectedPlayerSource(event) &&
      event.target === context.targetAddress &&
      CONDITION_TRANSFER_SKILLS.has(event.skillId) &&
      (event.activation !== 0 || event.value > 0),
  );
  const traitDurationMs = mechanics.duration * 1000 * 1.2;
  const maximumTraitDurationMs = mechanics.duration * 1000 * 2;
  const cleanDurationCandidates = bleeding.filter(
    (application) =>
      near(directSignals, application, DIRECT_SIGNAL_WINDOW_MS).length === 0 &&
      near(transferSignals, application, DIRECT_SIGNAL_WINDOW_MS).length ===
        0 &&
      near(criticals, application, PROC_WINDOW_MS).length > 0 &&
      application.value >= traitDurationMs &&
      application.value <= maximumTraitDurationMs,
  );
  const durationCounts = new Map<number, number>();
  for (const application of cleanDurationCandidates) {
    durationCounts.set(
      application.value,
      (durationCounts.get(application.value) || 0) + 1,
    );
  }
  const [modalDuration, modalDurationCount = 0] = [...durationCounts].sort(
    (left, right) => right[1] - left[1] || left[0] - right[0],
  )[0] || [0, 0];
  const derivedTraitDurationMs =
    modalDurationCount >= 3 &&
    modalDurationCount / Math.max(1, cleanDurationCandidates.length) >= 0.75
      ? modalDuration
      : null;
  const preliminary = new Map<
    ParsedEvtcEvent,
    {
      readonly kind: "exact" | "inferred" | "ambiguous";
      readonly criticals: readonly ParsedEvtcEvent[];
    }
  >();
  let excludedDirectApplications = 0;
  let excludedIncompatibleDurationApplications = 0;
  let excludedUncorrelatedApplications = 0;
  for (const application of bleeding) {
    const matchesDerivedDuration =
      derivedTraitDurationMs !== null &&
      Math.abs(application.value - derivedTraitDurationMs) <=
        DURATION_TOLERANCE_MS;
    if (
      near(directSignals, application, DIRECT_SIGNAL_WINDOW_MS).length &&
      !matchesDerivedDuration
    ) {
      excludedDirectApplications += 1;
      continue;
    }
    if (
      application.value < traitDurationMs - DURATION_TOLERANCE_MS ||
      application.value > maximumTraitDurationMs + DURATION_TOLERANCE_MS ||
      (derivedTraitDurationMs !== null && !matchesDerivedDuration)
    ) {
      excludedIncompatibleDurationApplications += 1;
      continue;
    }
    const possibleCriticals = near(criticals, application, PROC_WINDOW_MS);
    if (!possibleCriticals.length) {
      excludedUncorrelatedApplications += 1;
      continue;
    }
    if (near(transferSignals, application, DIRECT_SIGNAL_WINDOW_MS).length) {
      preliminary.set(application, {
        kind: "ambiguous",
        criticals: possibleCriticals,
      });
      continue;
    }
    const durationDifference = Math.abs(application.value - traitDurationMs);
    preliminary.set(application, {
      kind:
        durationDifference <= DURATION_TOLERANCE_MS
          ? "exact"
          : matchesDerivedDuration
            ? "inferred"
            : "ambiguous",
      criticals: possibleCriticals,
    });
  }

  const byCritical = new Map<ParsedEvtcEvent, ParsedEvtcEvent[]>();
  for (const [application, candidate] of preliminary) {
    if (candidate.kind === "ambiguous" || candidate.criticals.length !== 1) {
      continue;
    }
    const critical = candidate.criticals[0];
    const matches = byCritical.get(critical) || [];
    matches.push(application);
    byCritical.set(critical, matches);
  }
  let exact = 0;
  let inferred = 0;
  let ambiguousEvents = 0;
  const groupedApplications = new Set<ParsedEvtcEvent>();
  for (const matches of byCritical.values()) {
    if (matches.length <= 1) continue;
    ambiguousEvents += matches.length;
    matches.forEach((application) => groupedApplications.add(application));
  }
  for (const [application, candidate] of preliminary) {
    if (groupedApplications.has(application)) continue;
    if (candidate.kind === "exact") exact += 1;
    else if (candidate.kind === "inferred") inferred += 1;
    else {
      ambiguousEvents += 1;
    }
  }
  const classified = exact + inferred;
  const maximumMatchedCandidates = maximumOneToOneMatches(preliminary);
  const minimumPossible = Math.min(classified, maximumMatchedCandidates);
  const maximumPossible = Math.max(minimumPossible, maximumMatchedCandidates);
  if (classified > minimumPossible) {
    ambiguousEvents += classified - minimumPossible;
  }
  const status: AttributionStatus = ambiguousEvents
    ? "ambiguous"
    : inferred
      ? "inferred"
      : "exact";
  const hasRange = minimumPossible !== maximumPossible;
  const observedCandidateCount = hasRange
    ? `${minimumPossible}–${maximumPossible}`
    : minimumPossible;
  const expected = criticals.length * mechanics.chanceOnCriticalHit;
  const formatRate = (count: number): string =>
    `${((count / criticals.length) * 100).toFixed(2)}%`;
  const observedRate = criticals.length
    ? hasRange
      ? `${formatRate(minimumPossible)}–${formatRate(maximumPossible)}`
      : formatRate(minimumPossible)
    : "Not applicable (no eligible critical hits)";
  const formatDifference = (count: number): string => {
    const difference = count - expected;
    return `${difference > 0 ? "+" : ""}${difference.toFixed(2)} procs`;
  };
  const differenceFromExpectation = hasRange
    ? `${formatDifference(minimumPossible)} to ${formatDifference(maximumPossible)}`
    : formatDifference(minimumPossible);
  const explicitApplications = bleeding.filter(
    (event) => event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY,
  ).length;

  return {
    analyzerId: "necromancer",
    sections: [
      {
        id: "necromancer.barbed-precision",
        title: mechanics.name,
        status,
        fields: [
          { label: "Trait ID", value: mechanics.traitId },
          {
            label: "Applicable proc chance",
            value: `${mechanics.chanceOnCriticalHit * 100}%`,
          },
          { label: "Eligible critical hits", value: criticals.length },
          {
            label: "Expected procs if equipped",
            value: Number(expected.toFixed(2)),
          },
          { label: "Observed candidate procs", value: observedCandidateCount },
          { label: "Minimum possible procs", value: minimumPossible },
          { label: "Maximum possible procs", value: maximumPossible },
          {
            label: "Observed proc rate",
            value: observedRate,
          },
          {
            label: "Difference from expectation",
            value: differenceFromExpectation,
          },
          { label: "Ambiguous events", value: ambiguousEvents },
        ],
        evidence: [
          `${criticals.length} player-originated critical strikes against the recognized golem.`,
          `${bleeding.length} outgoing Bleeding applications (${explicitApplications} explicit CBTS_BUFFAPPLY, ${bleeding.length - explicitApplications} legacy).`,
          `${excludedDirectApplications} applications excluded by known direct Necromancer Bleeding skills.`,
          `${excludedIncompatibleDurationApplications} applications excluded because their duration did not match a possible Barbed Precision application.`,
          `${excludedUncorrelatedApplications} applications excluded because no critical strike occurred within ${PROC_WINDOW_MS} ms.`,
          ...(derivedTraitDurationMs === null
            ? []
            : [
                `A stable ${(derivedTraitDurationMs / 1000).toFixed(1)}s candidate duration was derived from ${modalDurationCount} non-conflicting applications and reused to separate Barbed Precision from direct skill Bleeding.`,
              ]),
          `Candidate duration compared with the ${mechanics.duration}s base duration plus Barbed Precision's simulator-modeled 20% Bleeding duration.`,
        ],
        assumptions: [
          "EVTC does not prove that the Curses specialization or Barbed Precision was equipped; all expected values are conditional on the trait being active.",
          "Unlogged expertise, runes, food, and other duration modifiers can make otherwise correlated applications inferred rather than exact.",
          "Condition transfers and multiple applications matched to critical strikes remain bounded with at most one proc per eligible critical hit.",
        ],
      },
    ],
    warnings: [
      "Barbed Precision causality is not directly labeled in EVTC; attribution is based on timing, source, target, duration, and known conflicting skills.",
    ],
  };
}

export const necromancerEvtcAnalyzer: EvtcProfessionAnalyzer = Object.freeze({
  id: "necromancer",
  professionId: "necromancer",
  analyze: barbedPrecisionAnalysis,
});
