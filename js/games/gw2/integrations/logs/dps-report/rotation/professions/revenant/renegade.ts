import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { normalizedName as normalized } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { createInferredAction } from '#gw2/integrations/logs/dps-report/rotation/create-inferred-action.js';
import type {
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '#gw2/integrations/logs/dps-report/rotation/types.js';

const ICERAZOR = Object.freeze({ name: "Icerazor's Ire", skillId: 40485 });
const RAZORCLAW = Object.freeze({ name: "Razorclaw's Rage", skillId: 42949 });
const DARKRAZOR = Object.freeze({ name: "Darkrazor's Daring", skillId: 41220 });
const BREAKRAZOR = Object.freeze({ name: "Breakrazor's Bastion", skillId: 45686 });
const WARBAND_ACTIONS = Object.freeze([ICERAZOR, RAZORCLAW, DARKRAZOR, BREAKRAZOR]);
const LEGEND_APPLICATION_DELAY_MS = 100;
const ENHANCED_RAZORCLAW_SIGNAL_ID = 72363;
const ENHANCED_DARKRAZOR_SIGNAL_ID = 72366;

function catalogSkill(context: DpsReportProfessionReconstructionContext, name: string): Skill | null {
  return context.catalog?.skills.find((skill) => normalized(skill.name) === normalized(name)) || null;
}

function isOtherLegend(action: DpsReportRecordedAction): boolean {
  const name = normalized(action.rawName);
  return name.startsWith('legendary ') && name !== 'legendary renegade stance';
}

function usesChargedMists(context: DpsReportProfessionReconstructionContext): boolean {
  const specializations = context.professionConfig?.specializations;
  if (!Array.isArray(specializations)) return false;
  const invocation = specializations.find((entry) => {
    if (entry == null || typeof entry !== 'object') return false;
    return normalized((entry as Record<string, unknown>).name) === 'invocation';
  }) as Record<string, unknown> | undefined;
  return (
    String(invocation?.traits || '')
      .split('-')
      .at(2) === '2'
  );
}

function needsPowerEnergyPrecast(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[],
  recurring: ReadonlySet<string>
): boolean {
  const weapons = context.professionConfig?.weapons;
  const firstOtherLegend = actions.find(isOtherLegend);
  return Boolean(
    context.professionConfig?.startingLegend === 'LegendaryRenegade' &&
    Array.isArray(weapons) &&
    weapons.some((weapon) => normalized(weapon) === 'greatsword') &&
    usesChargedMists(context) &&
    normalized(firstOtherLegend?.rawName) === 'legendary assassin stance' &&
    recurring.has(normalized(ICERAZOR.name)) &&
    !actions.some((action) => normalized(action.rawName) === normalized(DARKRAZOR.name))
  );
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
  return createInferredAction(
    { id: identity.skillId, name: identity.name },
    start,
    start + duration,
    anchor.eventIndex + eventOffset,
    'renegade-warband',
    { status: instant ? 'instant' : 'completed' }
  );
}

function recurringOpeningWarband(actions: readonly DpsReportRecordedAction[]): ReadonlySet<string> {
  const firstOtherLegend = actions.findIndex(isOtherLegend);
  const nextRenegade = actions.findIndex(
    (action, index) => index > firstOtherLegend && normalized(action.rawName) === 'legendary renegade stance'
  );
  const followingOtherLegend = actions.findIndex((action, index) => index > nextRenegade && isOtherLegend(action));
  if (firstOtherLegend <= 0 || nextRenegade < 0 || followingOtherLegend < 0) return new Set();
  const openingNames = new Set(actions.slice(0, firstOtherLegend).map((action) => normalized(action.rawName)));
  const recurringNames = new Set(
    actions.slice(nextRenegade + 1, followingOtherLegend).map((action) => normalized(action.rawName))
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
    // Band Together reports the enhanced summon signal, but rotations must
    // cast the base warband skill so the simulator can apply the active trait.
    .map((action) => {
      const warband = WARBAND_ACTIONS.find((identity) => normalized(action.rawName) === normalized(identity.name));
      return warband ? { ...action, canonicalSkillId: warband.skillId, canonicalName: warband.name } : action;
    })
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  // EI's terminal enhanced Razorclaw signal can land inside the preceding
  // animation. The next committed autoattack proves the input lane boundary.
  const sorted = canonicalized.map((action, index) => {
    if (action.rawSkillId !== ENHANCED_RAZORCLAW_SIGNAL_ID || canonicalized.slice(index + 1).some(isOtherLegend)) {
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
  // EI timestamps enhanced Darkrazor during the animation it overlaps. Place
  // the simulator command at that cast-lane boundary so its energy spend and
  // the following Charged Mists swap remain executable across Renegade logs.
  const alignedWarband = sorted.map((action) => {
    if (action.rawSkillId !== ENHANCED_DARKRAZOR_SIGNAL_ID) return action;
    const overlappingCast = sorted.find(
      (candidate) => candidate !== action && candidate.start <= action.start && candidate.end > action.start
    );
    return overlappingCast ? { ...action, start: overlappingCast.end, end: overlappingCast.end } : action;
  });
  const anchor = alignedWarband[0];
  if (!anchor) return [];
  const recurring = recurringOpeningWarband(alignedWarband);
  const inferred: DpsReportRecordedAction[] = [];
  if (recurring.has(normalized(ICERAZOR.name))) {
    const skill = catalogSkill(context, ICERAZOR.name);
    const duration = Math.max(0, Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0));
    const powerEnergyPrecast = needsPowerEnergyPrecast(context, alignedWarband, recurring);
    // A Charged Mists power opener uses an out-of-phase Darkrazor cast to drain
    // below the swap threshold. Build state and the repeated Icerazor cycle keep
    // that recovery specific to logs which prove this opener.
    if (powerEnergyPrecast) {
      const darkrazor = catalogSkill(context, DARKRAZOR.name);
      const darkrazorDuration = Math.max(0, Number(darkrazor?.quicknessCastTimeMs || darkrazor?.castTimeMs || 0));
      const action = inferredWarbandAction(
        context,
        anchor,
        DARKRAZOR,
        anchor.start - duration - darkrazorDuration,
        -3,
        false
      );
      if (action) inferred.push(action);
    }

    const action = inferredWarbandAction(context, anchor, ICERAZOR, anchor.start - duration, -2, false);
    if (action) inferred.push(powerEnergyPrecast ? { ...action, followingWaitMs: duration } : action);
  }

  if (recurring.has(normalized(RAZORCLAW.name))) {
    const firstOtherLegend = alignedWarband.find(isOtherLegend);
    const availableGap = Math.max(0, Number(firstOtherLegend?.start ?? anchor.start) - anchor.start);
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

  const firstOtherLegend = alignedWarband.find(isOtherLegend);
  // EI timestamps the opening legend at its applied state; align it to the
  // player input so the observed Searing/Razorclaw overlap and energy reset survive.
  const aligned =
    inferred.length && firstOtherLegend
      ? alignedWarband.map((action) =>
          action === firstOtherLegend
            ? {
                ...action,
                start: action.start - LEGEND_APPLICATION_DELAY_MS,
                end: action.end - LEGEND_APPLICATION_DELAY_MS
              }
            : action
        )
      : alignedWarband;
  return [...inferred, ...aligned].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
}
