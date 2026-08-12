import { RANGER_CORE_BASE_SKILL_MECHANICS } from "../../professions/ranger/core/skills.js";
import { RANGER_PET_SKILLS } from "../../professions/ranger/data/ranger-pet-data.js";
import { RANGER_TRAIT_IDS } from "../../professions/ranger/data/ids.js";
import { EVTC_STATE_CHANGE } from "../types.js";
import type { EvtcAnalysisContext } from "../context.js";
import type {
  AttributionStatus,
  ParsedEvtcEvent,
  ProfessionAnalysisResult,
} from "../types.js";
import type { EvtcProfessionAnalyzer } from "./contract.js";

const BLEEDING_BUFF_ID = 736;
const PROC_WINDOW_MS = 50;
const DIRECT_SIGNAL_WINDOW_MS = 100;
// Sharpened Edges applies 1-stack Bleeding for 3s and has no inherent duration
// bonus, so the observed duration is base × (1 + unlogged expertise/food).
const BASE_DURATION_SECONDS = 3;
const EXACT_DURATION_MS = BASE_DURATION_SECONDS * 1000;
const MINIMUM_DURATION_MS = BASE_DURATION_SECONDS * 1000 - 100;
const MAXIMUM_DURATION_MS = BASE_DURATION_SECONDS * 1000 * 2 + 100;

type EffectLike = {
  readonly type?: string;
  readonly condition?: string;
  readonly ticks?: readonly { readonly condition?: string }[];
  readonly applications?: readonly { readonly condition?: string }[];
};

function appliesBleeding(effect: EffectLike): boolean {
  if (effect.type !== "condition") return false;
  if (effect.condition === "Bleeding") return true;
  return (effect.ticks || effect.applications || []).some(
    (application) => application.condition === "Bleeding",
  );
}

// Core skills expose structured condition effects; pet family skills only carry
// English descriptions, so their direct Bleeding is matched by keyword. Both are
// used to keep skill-applied Bleeding from being mistaken for the trait proc.
const DIRECT_BLEEDING_SKILLS = new Set<number>([
  ...Object.entries(RANGER_CORE_BASE_SKILL_MECHANICS)
    .filter(([, skill]) =>
      ((skill as { readonly effects?: readonly EffectLike[] }).effects || [])
        .some(appliesBleeding),
    )
    .map(([id]) => Number(id))
    .filter(Number.isFinite),
  ...RANGER_PET_SKILLS.filter((skill) =>
    /\bbleed(?:s|ing)?\b/i.test(String(skill.description || "")),
  )
    .map((skill) => Number(skill.id))
    .filter(Number.isFinite),
]);

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

interface ScopeCounts {
  readonly exact: number;
  readonly inferred: number;
  readonly ambiguousEvents: number;
  readonly ambiguousMaximum: number;
  readonly excludedDirect: number;
  readonly excludedUncorrelated: number;
  readonly excludedOutOfBand: number;
  readonly explicitApplications: number;
  readonly derivedDurationMs: number | null;
  readonly modalDurationCount: number;
}

// Sharpened Edges fires independently on the ranger and on the pet, and each
// applies its Bleeding from its own source, so a scope (player or pet) is
// correlated only against that scope's critical strikes.
function classifyScope(
  criticals: readonly ParsedEvtcEvent[],
  bleeding: readonly ParsedEvtcEvent[],
  directSignals: readonly ParsedEvtcEvent[],
): ScopeCounts {
  const inBand = (value: number): boolean =>
    value >= MINIMUM_DURATION_MS && value <= MAXIMUM_DURATION_MS;
  const cleanCandidates = bleeding.filter(
    (application) =>
      inBand(application.value) &&
      near(directSignals, application, DIRECT_SIGNAL_WINDOW_MS).length === 0 &&
      near(criticals, application, PROC_WINDOW_MS).length > 0,
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
      readonly criticals: readonly ParsedEvtcEvent[];
    }
  >();
  let excludedDirect = 0;
  let excludedUncorrelated = 0;
  let excludedOutOfBand = 0;
  for (const application of bleeding) {
    const matchesDerived =
      derivedDurationMs !== null &&
      Math.abs(application.value - derivedDurationMs) <= 100;
    if (!inBand(application.value) && !matchesDerived) {
      excludedOutOfBand += 1;
      continue;
    }
    if (
      near(directSignals, application, DIRECT_SIGNAL_WINDOW_MS).length &&
      !matchesDerived
    ) {
      excludedDirect += 1;
      continue;
    }
    const possibleCriticals = near(criticals, application, PROC_WINDOW_MS);
    if (!possibleCriticals.length) {
      excludedUncorrelated += 1;
      continue;
    }
    const durationDifference = Math.abs(application.value - EXACT_DURATION_MS);
    preliminary.set(application, {
      kind:
        durationDifference <= 100
          ? "exact"
          : matchesDerived
            ? "inferred"
            : "ambiguous",
      criticals: possibleCriticals,
    });
  }

  // Several applications that resolve to one critical strike cannot all be
  // separate procs of it, so bound that cluster to a single proc.
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
  let ambiguousMaximum = 0;
  const groupedApplications = new Set<ParsedEvtcEvent>();
  for (const matches of byCritical.values()) {
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
  const explicitApplications = bleeding.filter(
    (event) => event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY,
  ).length;

  return {
    exact,
    inferred,
    ambiguousEvents,
    ambiguousMaximum,
    excludedDirect,
    excludedUncorrelated,
    excludedOutOfBand,
    explicitApplications,
    derivedDurationMs,
    modalDurationCount,
  };
}

function sharpenedEdgesAnalysis(
  context: EvtcAnalysisContext,
): ProfessionAnalysisResult {
  const isPet = (event: ParsedEvtcEvent): boolean =>
    context.isPlayerOwnedSource(event) &&
    !context.isSelectedPlayerSource(event);
  const ownedStrikes = context.log.events.filter(
    (event) =>
      context.isPlayerOwnedSource(event) &&
      context.isDamageToTarget(event) &&
      event.buff === 0 &&
      event.value > 0,
  );
  const playerCriticals = ownedStrikes.filter(
    (event) => context.isSelectedPlayerSource(event) && event.result === 1,
  );
  const petCriticals = ownedStrikes.filter(
    (event) => isPet(event) && event.result === 1,
  );
  const bleeding = context.log.events.filter(
    (event) =>
      context.isPlayerOwnedSource(event) &&
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
      context.isPlayerOwnedSource(event) &&
      event.target === context.targetAddress &&
      DIRECT_BLEEDING_SKILLS.has(event.skillId) &&
      (event.activation !== 0 || event.value > 0),
  );

  const player = classifyScope(
    playerCriticals,
    bleeding.filter((event) => context.isSelectedPlayerSource(event)),
    directSignals.filter((event) => context.isSelectedPlayerSource(event)),
  );
  const pet = classifyScope(
    petCriticals,
    bleeding.filter(isPet),
    directSignals.filter(isPet),
  );

  const exact = player.exact + pet.exact;
  const inferred = player.inferred + pet.inferred;
  const ambiguousEvents = player.ambiguousEvents + pet.ambiguousEvents;
  const ambiguousMaximum = player.ambiguousMaximum + pet.ambiguousMaximum;
  const classified = exact + inferred;
  const minimumPossible = classified;
  const maximumPossible = classified + ambiguousMaximum;
  const status: AttributionStatus = ambiguousEvents
    ? "ambiguous"
    : inferred
      ? "inferred"
      : "exact";
  const totalCriticals = playerCriticals.length + petCriticals.length;
  const chance = 0.33;
  const expected = totalCriticals * chance;
  const formatRate = (count: number): string =>
    `${((count / totalCriticals) * 100).toFixed(2)}%`;
  const observedRate = totalCriticals
    ? status === "ambiguous"
      ? `${formatRate(minimumPossible)}–${formatRate(maximumPossible)}`
      : formatRate(classified)
    : "Not applicable (no eligible critical hits)";
  const formatDifference = (count: number): string => {
    const difference = count - expected;
    return `${difference > 0 ? "+" : ""}${difference.toFixed(2)} procs`;
  };
  const differenceFromExpectation =
    status === "ambiguous"
      ? `${formatDifference(minimumPossible)} to ${formatDifference(maximumPossible)}`
      : formatDifference(classified);
  const observedCandidateCount =
    status === "ambiguous"
      ? `${minimumPossible}–${maximumPossible}`
      : classified;
  const derivedDurationMs = player.derivedDurationMs ?? pet.derivedDurationMs;

  return {
    analyzerId: "ranger",
    sections: [
      {
        id: "ranger.sharpened-edges",
        title: "Sharpened Edges",
        status,
        fields: [
          { label: "Trait ID", value: RANGER_TRAIT_IDS.SHARPENED_EDGES },
          { label: "Applicable proc chance", value: `${chance * 100}%` },
          { label: "Your critical hits", value: playerCriticals.length },
          { label: "Pet critical hits", value: petCriticals.length },
          { label: "Eligible critical hits", value: totalCriticals },
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
          `${playerCriticals.length} ranger and ${petCriticals.length} pet critical strikes against the recognized golem (${totalCriticals} eligible).`,
          `${bleeding.length} owned Bleeding applications (${player.explicitApplications + pet.explicitApplications} explicit CBTS_BUFFAPPLY, ${bleeding.length - player.explicitApplications - pet.explicitApplications} legacy).`,
          `${player.excludedDirect + pet.excludedDirect} applications excluded by known direct Ranger and pet Bleeding skills.`,
          `${player.excludedUncorrelated + pet.excludedUncorrelated} applications excluded because no critical strike from the same source occurred within ${PROC_WINDOW_MS} ms.`,
          `${player.excludedOutOfBand + pet.excludedOutOfBand} applications excluded because their duration fell outside the ${(MINIMUM_DURATION_MS / 1000).toFixed(1)}–${(MAXIMUM_DURATION_MS / 1000).toFixed(1)}s Sharpened Edges band.`,
          ...(derivedDurationMs === null
            ? []
            : [
                `A stable ${(derivedDurationMs / 1000).toFixed(1)}s candidate duration was derived from non-conflicting applications and used to separate Sharpened Edges from direct-skill Bleeding.`,
              ]),
          `Candidate duration compared with the ${BASE_DURATION_SECONDS}s base Sharpened Edges Bleeding duration.`,
        ],
        assumptions: [
          "EVTC does not prove that Sharpened Edges was equipped; every expected value is conditional on the trait being active.",
          "Pet critical strikes and Bleeding are attributed through EVTC master-instance ownership, so pet swaps are aggregated under the ranger.",
          "Pet direct-skill Bleeding (for example Maul or Twin Darts) is identified by skill description and duration; anything indistinguishable from the proc is bounded instead of counted.",
        ],
      },
    ],
    warnings: [
      "Sharpened Edges causality is not directly labeled in EVTC; attribution is based on the critical strike source, timing, target, duration, and known conflicting skills.",
    ],
  };
}

export const rangerEvtcAnalyzer: EvtcProfessionAnalyzer = Object.freeze({
  id: "ranger",
  professionId: "ranger",
  analyze: sharpenedEdgesAnalysis,
});
