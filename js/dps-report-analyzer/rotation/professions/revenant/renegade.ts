import type { Skill } from '../../../../platform/engine/types.js';
import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../../types.js';

const ICERAZOR = Object.freeze({ name: "Icerazor's Ire", skillId: 40485 });
const RAZORCLAW = Object.freeze({ name: "Razorclaw's Rage", skillId: 42949 });
const LEGEND_APPLICATION_DELAY_MS = 100;
const ENHANCED_RAZORCLAW_SIGNAL_ID = 72363;

function normalized(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function catalogSkill(context: DpsReportProfessionReconstructionContext, name: string): Skill | null {
  return context.catalog?.skills.find((skill) => normalized(skill.name) === normalized(name)) || null;
}

function inferredWarbandAction(
  context: DpsReportProfessionReconstructionContext,
  anchor: DpsReportRecordedAction,
  identity: { readonly name: string; readonly skillId: number },
  start: number,
  eventOffset: number,
  instant: boolean
): DpsReportRecordedAction | null {
  const skill = catalogSkill(context, identity.name);
  if (!skill || typeof skill.id !== 'number') return null;
  const duration = instant ? 0 : Math.max(0, Number(skill.quicknessCastTimeMs || skill.castTimeMs || 0));
  return {
    start,
    end: start + duration,
    rawSkillId: identity.skillId,
    rawName: identity.name,
    status: instant ? 'instant' : 'completed',
    eventIndex: anchor.eventIndex + eventOffset,
    isSwap: false,
    metadataAccurate: false,
    inference: 'renegade-warband',
    canonicalSkillId: identity.skillId,
    canonicalName: identity.name
  };
}

function recurringOpeningWarband(actions: readonly DpsReportRecordedAction[]): ReadonlySet<string> {
  const firstDemon = actions.findIndex((action) => normalized(action.rawName) === 'legendary demon stance');
  const nextRenegade = actions.findIndex(
    (action, index) => index > firstDemon && normalized(action.rawName) === 'legendary renegade stance'
  );
  const followingDemon = actions.findIndex(
    (action, index) => index > nextRenegade && normalized(action.rawName) === 'legendary demon stance'
  );
  if (firstDemon <= 0 || nextRenegade < 0 || followingDemon < 0) return new Set();
  const openingNames = new Set(actions.slice(0, firstDemon).map((action) => normalized(action.rawName)));
  const recurringNames = new Set(
    actions.slice(nextRenegade + 1, followingDemon).map((action) => normalized(action.rawName))
  );
  return new Set(
    [ICERAZOR.name, RAZORCLAW.name]
      .map(normalized)
      .filter((name) => recurringNames.has(name) && !openingNames.has(name))
  );
}

/** Recovers omitted opening warband summons and maps EI's enhanced Razorclaw signal to the castable skill. */
export function reconstructRenegadeDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const canonicalized = [...context.recordedActions]
    .map((action) =>
      normalized(action.rawName) === normalized(RAZORCLAW.name)
        ? { ...action, canonicalSkillId: RAZORCLAW.skillId, canonicalName: RAZORCLAW.name }
        : action
    )
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  // EI's terminal enhanced Razorclaw signal can land inside the preceding
  // animation. The next committed autoattack proves the input lane boundary.
  const sorted = canonicalized.map((action, index) => {
    if (
      action.rawSkillId !== ENHANCED_RAZORCLAW_SIGNAL_ID ||
      canonicalized.slice(index + 1).some((candidate) => normalized(candidate.rawName) === 'legendary demon stance')
    ) {
      return action;
    }

    const nextAutoattack = canonicalized.slice(index + 1).find((candidate) => {
      const skill = context.catalog?.skills.find(
        (catalogEntry) =>
          (typeof catalogEntry.id === 'number' && Number(catalogEntry.id) === candidate.rawSkillId) ||
          normalized(catalogEntry.name) === normalized(candidate.rawName)
      );
      return normalized(skill?.slot) === 'weapon_1';
    });
    if (!nextAutoattack) return action;
    const start = nextAutoattack.start + LEGEND_APPLICATION_DELAY_MS;
    return { ...action, start, end: start, eventIndex: nextAutoattack.eventIndex + 0.25 };
  });
  const anchor = sorted[0];
  if (!anchor) return [];
  const recurring = recurringOpeningWarband(sorted);
  const inferred: DpsReportRecordedAction[] = [];
  if (recurring.has(normalized(ICERAZOR.name))) {
    const skill = catalogSkill(context, ICERAZOR.name);
    const duration = Math.max(0, Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0));
    const action = inferredWarbandAction(context, anchor, ICERAZOR, anchor.start - duration, -2, false);
    if (action) inferred.push(action);
  }

  if (recurring.has(normalized(RAZORCLAW.name))) {
    const firstDemon = sorted.find((action) => normalized(action.rawName) === 'legendary demon stance');
    const availableGap = Math.max(0, Number(firstDemon?.start ?? anchor.start) - anchor.start);
    const action = inferredWarbandAction(
      context,
      anchor,
      RAZORCLAW,
      anchor.start + Math.min(400, Math.max(0, availableGap - 1)),
      -1,
      true
    );
    if (action) inferred.push(action);
  }

  const firstDemon = sorted.find((action) => normalized(action.rawName) === 'legendary demon stance');
  // EI timestamps the opening legend at its applied state; align it to the
  // player input so the observed Searing/Razorclaw overlap and energy reset survive.
  const aligned =
    inferred.length && firstDemon
      ? sorted.map((action) =>
          action === firstDemon
            ? {
                ...action,
                start: action.start - LEGEND_APPLICATION_DELAY_MS,
                end: action.end - LEGEND_APPLICATION_DELAY_MS
              }
            : action
        )
      : sorted;
  return [...inferred, ...aligned].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
}
