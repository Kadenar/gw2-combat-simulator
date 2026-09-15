import { WingmanError } from '#gw2/integrations/logs/wingman/errors.js';

function record(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

// gw2wingman's getJson serves Elite Insights' HTML-embed log format, not the raw getJson
// schema dps.report exposes. Per-player rotation is bucketed one array per phase, each cast a
// tuple [atSeconds, skillId, durationMs, statusId, quickness] (EI GW2EIBuilders SkillCastDto),
// and skillMap entries use EI's short html field names (aa/isSwap/notAccurate/traitProc/...).
// This module reshapes that into the same {players[].rotation, phases, skillMap} document
// dps-report/parser.ts validates, so every downstream reconstruction rule is shared verbatim.

type WingmanCastTuple = readonly [number, number, number, number, number];

// AnimationStatus enum (GW2EIEvtcParser CastEvent.cs): Unknown, Reduced, Interrupted, Full, Instant.
function timeGainedFromStatus(statusId: number): number {
  if (statusId === 1) return 1; // Reduced: quickness/other trimmed the aftercast short.
  if (statusId === 2) return -1; // Interrupted: cast was cancelled before completing.
  return 0; // Unknown / Full / Instant: castStatus() decides those from duration alone.
}

function normalizeRotationTuple(tuple: unknown): WingmanCastTuple | null {
  if (!Array.isArray(tuple) || tuple.length < 5) return null;
  const [at, skillId, durationMs, statusId, quickness] = tuple;
  if (![at, skillId, durationMs, statusId, quickness].every((value) => typeof value === 'number' && Number.isFinite(value))) {
    return null;
  }

  return [at, skillId, durationMs, statusId, quickness];
}

/** Groups one phase's flat, time-ordered cast list by skill id, matching the raw dps.report shape. */
function buildRotationGroups(entries: readonly unknown[]): { readonly id: number; readonly skills: unknown[] }[] {
  const groups = new Map<number, unknown[]>();
  for (const raw of entries) {
    const tuple = normalizeRotationTuple(raw);
    if (!tuple) continue;
    const [at, skillId, durationMs, statusId, quickness] = tuple;
    let skills = groups.get(skillId);
    if (!skills) {
      skills = [];
      groups.set(skillId, skills);
    }

    skills.push({
      castTime: Math.round(at * 1000),
      duration: Math.max(0, Math.round(durationMs)),
      timeGained: timeGainedFromStatus(statusId),
      quickness
    });
  }

  return [...groups.entries()].map(([id, skills]) => ({ id, skills }));
}

/** The full-fight phase is the only one covering every cast; EI always emits it, size determines it. */
function fullFightPhaseIndex(phases: readonly unknown[]): number {
  let bestIndex = 0;
  let bestSpan = -Infinity;
  phases.forEach((phase, index) => {
    if (!record(phase) || typeof phase.start !== 'number' || typeof phase.end !== 'number') return;
    const span = phase.end - phase.start;
    if (span > bestSpan) {
      bestSpan = span;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function normalizeSkillMap(rawMap: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, metadata] of Object.entries(rawMap)) {
    if (!record(metadata)) continue;
    result[key] = {
      name: metadata.name,
      icon: metadata.icon,
      autoAttack: metadata.aa === true,
      isSwap: metadata.isSwap === true,
      isNotAccurate: metadata.notAccurate === true,
      isTraitProc: metadata.traitProc === true,
      isUnconditionalProc: metadata.unconditionalProc === true,
      isGearProc: metadata.gearProc === true
    };
  }

  return result;
}

function normalizePlayer(value: unknown, phaseIndex: number): Record<string, unknown> {
  if (!record(value) || typeof value.name !== 'string' || typeof value.profession !== 'string') {
    throw new WingmanError('INVALID_PLAYER', 'The gw2wingman report contains an invalid player entry.');
  }

  const details = record(value.details) ? value.details : {};
  const rotationByPhase = Array.isArray(details.rotation) ? details.rotation : [];
  const fullFightRotation = Array.isArray(rotationByPhase[phaseIndex]) ? rotationByPhase[phaseIndex] : [];

  return {
    name: value.name,
    account: value.acc,
    profession: value.profession,
    group: value.group,
    rotation: buildRotationGroups(fullFightRotation)
  };
}

/** Converts a gw2wingman getJson payload into the same shape dps-report/parser.ts validates. */
export function normalizeWingmanReport(value: unknown): unknown {
  if (!record(value) || typeof value.error === 'string') {
    throw new WingmanError('REPORT_ERROR', `gw2wingman error: ${record(value) ? value.error : 'invalid payload'}`);
  }

  if (!Array.isArray(value.players) || !Array.isArray(value.phases) || !record(value.skillMap)) {
    throw new WingmanError('INVALID_REPORT', 'The gw2wingman report has no players, phases or skill metadata.');
  }

  const phaseIndex = fullFightPhaseIndex(value.phases);
  const phases = value.phases.map((phase) => {
    if (!record(phase) || typeof phase.start !== 'number' || typeof phase.end !== 'number') {
      throw new WingmanError('INVALID_PHASE', 'The gw2wingman report contains an invalid phase entry.');
    }

    return { name: phase.name, start: Math.round(phase.start * 1000), end: Math.round(phase.end * 1000) };
  });

  return {
    eliteInsightsVersion: value.parser,
    fightName: value.fightName,
    arcVersion: value.arcVersion,
    gW2Build: value.gw2Build,
    durationMS: phases[phaseIndex]?.end,
    players: value.players.map((player) => normalizePlayer(player, phaseIndex)),
    phases,
    skillMap: normalizeSkillMap(value.skillMap as Record<string, unknown>)
  };
}
