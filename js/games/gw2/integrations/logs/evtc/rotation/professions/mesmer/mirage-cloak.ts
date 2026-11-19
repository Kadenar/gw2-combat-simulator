import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/** Resolves cloak sources from owned raw evidence; a cloak gain alone never proves a dodge. */
export function mirageCloakActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const cloaks = context.recordedActions.filter((action) => action.rawSkillId === -17);
  const sourceBuffs = context.log.events.filter(
    (e) =>
      e.source === context.playerAddress &&
      e.target === context.playerAddress &&
      (e.stateChange === 69 || (e.stateChange === 0 && e.buff === 1 && e.buffRemove === 0)) &&
      e.value > 0 &&
      [69209, 42501].includes(e.skillId)
  );
  const teleports = context.evidence.effects.filter(
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
      ...(mirrorSources.has(action)
        ? [{ canonicalSkillId: ID.PICK_UP_MIRAGE_MIRROR, canonicalName: 'Pick Up Mirage Mirror' }]
        : []),
      ...(dodge ? [{ canonicalSkillId: ID.DODGE_MIRAGE_CLOAK, canonicalName: 'Dodge / Mirage Cloak' }] : []),
      ...(ambush ? [{ canonicalSkillId: ID.ILLUSIONARY_AMBUSH, canonicalName: 'Illusionary Ambush' }] : [])
    ];
    return sources.length === 1 ? { ...action, ...sources[0] } : action;
  });
}
