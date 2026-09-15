import { normalizeLogProfessionActions } from '#gw2/integrations/logs/lib/rotation/professions/index.js';
import { recordedActionSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

/** Replay an observed cloak through its represented source so shatters and mirrors do not spend dodge endurance. */
function mesmerCloakActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== 'mirage') return [...context.recordedActions];
  return context.recordedActions.flatMap((action) => {
    if (action.rawSkillId !== -17) return [action];
    const source = context.recordedActions.some(
      (other) =>
        [10190, 10191, 49068, -63, 10192, 10287, 43064, 45046].includes(other.rawSkillId) &&
        Math.abs(other.start - action.start) < 10
    );
    if (source) return [];
    const mirror = context.log.events.some(
      (e) =>
        e.source === context.playerAddress &&
        e.skillId === 44677 &&
        e.stateChange === 0 &&
        e.buff === 0 &&
        e.value > 0 &&
        Math.abs(e.time - action.start) < 10
    );
    // ponytail: unmatched cloak gains replay as dodges; add source rules when evidence identifies other cloak providers.
    return [
      {
        ...action,
        canonicalSkillId: mirror ? -2 : -1,
        canonicalName: mirror ? 'Pick Up Mirage Mirror' : 'Dodge / Mirage Cloak'
      }
    ];
  });
}

/** EI EngineerHelper.EngineerKitFinder requires a real kit swap followed by a bundle animation. */
function engineerKitActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  if (context.profile.professionId !== 'engineer') return [...context.recordedActions];
  const swaps = context.recordedActions.filter((a) => a.weaponSet != null);
  return context.recordedActions.map((action) => {
    if (action.weaponSet !== 2) return action;
    const nextSwap = swaps.find((a) => a.start > action.start + 10);
    const bundle = context.recordedActions.find(
      (a) =>
        a.start >= action.start + 75 &&
        a.start < (nextSwap?.start ?? Infinity) &&
        (a.evidence === 'animation' || a.evidence === 'legacy-activation') &&
        recordedActionSkill(a, context)?.kit
    );
    const kit = bundle ? String(recordedActionSkill(bundle, context)?.kit ?? '') : '';
    const equip = kit
      ? context.catalog?.skills.find((s) => s.handlerId === 'engineer.kit-equip' && s.kitName === kit)
      : undefined;
    return equip && typeof equip.id === 'number'
      ? {
          ...action,
          rawSkillId: equip.id,
          rawName: equip.name,
          canonicalSkillId: equip.id,
          canonicalName: equip.name,
          eiRule: 'EngineerHelper.EngineerKitFinder',
          metadataAccurate: false
        }
      : action;
  });
}

/** Both adapters convert represented variants and composites through the same source-independent rules. */
export function reconstructProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const represented = { ...context, recordedActions: mesmerCloakActions(context) };
  // Packet spacing only selects the represented Path of Scars range variant; it never creates a cast.
  const originals = engineerKitActions(represented).map((action, index, actions) => {
    if (context.profile.professionId !== 'ranger' || action.rawSkillId !== 12638) return action;
    const next = actions.slice(index + 1).find((a) => a.rawSkillId === 12638);
    const hits = context.log.events
      .filter(
        (e) =>
          e.source === context.playerAddress &&
          e.target !== context.playerAddress &&
          e.skillId === 12638 &&
          e.stateChange === 0 &&
          e.activation === 0 &&
          e.buff === 0 &&
          e.value > 0 &&
          e.time >= action.start &&
          e.time <= action.start + 3000 &&
          e.time < (next?.start ?? Infinity)
      )
      .sort((a, b) => a.time - b.time);
    return hits.length >= 2 && hits[1].time - hits[0].time > 900
      ? { ...action, canonicalSkillId: -1001, canonicalName: 'Path of Scars (Max Range)' }
      : action;
  });
  const recordedActions = originals.map((action, index) => ({
    ...action,
    eventIndex: index,
    sourceActionIndex: index,
    rawName: action.rawName === 'Swap Weapons' ? 'Weapon Swap' : action.rawName,
    isSwap: action.weaponSet != null,
    metadataAccurate: action.metadataAccurate ?? true,
    expectedDurationMs: action.expectedDuration ?? undefined
  }));
  // Keep source identity when available; normalization may also synthesize actions without a source row.
  return normalizeLogProfessionActions({ ...context, recordedActions }).map((action) => ({
    ...originals[action.sourceActionIndex!],
    ...action,
    eventIndex: originals[action.sourceActionIndex!]?.eventIndex ?? action.eventIndex,
    rawName: action.rawName === 'Weapon Swap' ? 'Swap Weapons' : action.rawName,
    // This read-only observation requires a landed packet during the represented airborne auto.
    ...(context.profile.specializationId === 'vindicator' &&
    action.concurrentTimeline &&
    context.log.events.some(
      (e) =>
        e.source === context.playerAddress &&
        e.skillId === action.rawSkillId &&
        e.stateChange === 0 &&
        e.buff === 0 &&
        e.value > 0 &&
        e.time >= action.start &&
        e.time <= action.end
    )
      ? { vindicatorDodgeAuto: true }
      : {})
  }));
}

export type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
