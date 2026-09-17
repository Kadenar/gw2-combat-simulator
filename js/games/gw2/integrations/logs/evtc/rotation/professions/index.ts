import { normalizeLogProfessionActions } from '#gw2/integrations/logs/shared/rotation/professions/index.js';
import { recordedActionSkill } from '#gw2/integrations/logs/shared/rotation/catalog.js';
import { effectEvidence } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

/** Resolves cloak sources from owned raw evidence; a cloak gain alone never proves a dodge. */
function mesmerCloakActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== 'mirage') return [...context.recordedActions];
  const cloaks = context.recordedActions.filter((action) => action.rawSkillId === -17);
  const sourceBuffs = context.log.events.filter(
    (e) =>
      e.source === context.playerAddress &&
      e.target === context.playerAddress &&
      (e.stateChange === 69 || (e.stateChange === 0 && e.buff === 1 && e.buffRemove === 0)) &&
      e.value > 0 &&
      [69209, 42501].includes(e.skillId)
  );
  const teleports = effectEvidence(context.log).filter(
    ({ event, guid }) =>
      guid === 'D7A05478BA0E164396EB90C037DCCF42' &&
      event.source === context.playerAddress &&
      event.target === context.playerAddress
  );
  const mirrorSources = new Set(
    context.log.events
      .filter(
        (e) =>
          e.source === context.playerAddress &&
          e.skillId === 44677 &&
          e.stateChange === 0 &&
          e.buff === 0 &&
          e.value > 0
      )
      .flatMap((hit) => {
        // Mirror damage can follow the cloak by 50 ms; require a unique gain so one hit cannot resolve two inputs.
        const candidates = cloaks.filter((action) => hit.time - action.start > -10 && hit.time - action.start <= 50);
        return candidates.length === 1 ? candidates : [];
      })
  );
  return context.recordedActions.map((action) => {
    if (action.rawSkillId !== -17) return action;
    const buffs = sourceBuffs.filter(
      (e) =>
        Math.abs(e.time - action.start) < 10 &&
        cloaks.filter((cloak) => Math.abs(e.time - cloak.start) < 10).length === 1
    );
    // Buff 69209 accompanies the dodge-origin cloak in modern EVTC, unlike the general ambush buff 43694.
    const dodge = buffs.some((e) => e.skillId === 69209);
    // False Stealth plus a self teleport identifies Illusionary Ambush only without a competing teleport cast.
    const ambush =
      buffs.some((e) => e.skillId === 42501) &&
      teleports.some(({ event }) => event.time >= action.start && event.time <= action.start + 20) &&
      !context.recordedActions.some(
        (other) => [45449, 43761].includes(other.rawSkillId) && Math.abs(other.start - action.start) <= 20
      );
    const sources = [
      ...(mirrorSources.has(action) ? [{ canonicalSkillId: -2, canonicalName: 'Pick Up Mirage Mirror' }] : []),
      ...(dodge ? [{ canonicalSkillId: -1, canonicalName: 'Dodge / Mirage Cloak' }] : []),
      ...(ambush ? [{ canonicalSkillId: 45046, canonicalName: 'Illusionary Ambush' }] : [])
    ];
    return sources.length === 1 ? { ...action, ...sources[0] } : action;
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
