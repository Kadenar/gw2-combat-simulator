import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { recordedActionSkill } from '#gw2/integrations/logs/shared/rotation/catalog.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

/** EI EngineerHelper.EngineerKitFinder requires a real kit swap followed by a bundle animation. */
export function engineerKitActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const swaps = context.recordedActions.filter((a) => a.weaponSet != null);
  // Bundle animations identify their kit through the recorded action's Engineer catalog skill.
  const kitIdOf = (recorded: EvtcRecordedRotationAction): EngineerSkill['kitId'] => {
    const skill: EngineerSkill | null = recordedActionSkill(recorded, context);
    return skill?.kitId;
  };

  return context.recordedActions.map((action) => {
    if (action.weaponSet !== 2) return action;

    const nextSwap = swaps.find((a) => a.start > action.start + 10);
    const bundle = context.recordedActions.find(
      (a) =>
        a.start >= action.start + 75 &&
        a.start < (nextSwap?.start ?? Infinity) &&
        (a.evidence === 'animation' || a.evidence === 'legacy-activation') &&
        kitIdOf(a)
    );
    const kit = bundle ? kitIdOf(bundle) : null;
    const equip = kit
      ? context.catalog?.skills.find((s) => (s as EngineerSkill).kitTransition === 'equip' && s.id === kit)
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
