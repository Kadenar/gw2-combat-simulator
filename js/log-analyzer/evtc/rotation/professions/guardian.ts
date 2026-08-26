import { normalizeGuardianAutoattacks } from './guardian/autoattacks.js';
import { addGuardianCommonActions, finalizeGuardianActions, prepareGuardianActions } from './guardian/common.js';
import { normalizeFirebrandWeaponTransitions, reconstructFirebrandActions } from './guardian/firebrand.js';
import { normalizeLuminaryWeaponTransitions, reconstructLuminaryActions } from './guardian/luminary.js';
import { normalizeDefaultGuardianWeaponTransitions } from './guardian/shared.js';
import { normalizeGuardianCompositeAnimations, reconstructWillbenderActions } from './guardian/willbender.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from './types.js';

type GuardianActionTransform = (
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
) => EvtcRecordedRotationAction[];

interface GuardianSpecializationAnalyzer {
  readonly normalizeWeaponTransitions?: GuardianActionTransform;
  readonly reconstruct?: GuardianActionTransform;
}

const specializationAnalyzers: ReadonlyMap<string, GuardianSpecializationAnalyzer> = new Map([
  [
    'firebrand',
    {
      normalizeWeaponTransitions: normalizeFirebrandWeaponTransitions,
      reconstruct: reconstructFirebrandActions
    }
  ],
  [
    'luminary',
    {
      normalizeWeaponTransitions: normalizeLuminaryWeaponTransitions,
      reconstruct: reconstructLuminaryActions
    }
  ],
  ['willbender', { reconstruct: reconstructWillbenderActions }]
]);

export function reconstructGuardianProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const analyzer = specializationAnalyzers.get(context.profile.specializationId);
  let actions = normalizeGuardianCompositeAnimations(context.recordedActions);
  actions = prepareGuardianActions(context, actions);
  actions = (analyzer?.normalizeWeaponTransitions || normalizeDefaultGuardianWeaponTransitions)(context, actions);
  actions = addGuardianCommonActions(context, actions);
  actions = analyzer?.reconstruct?.(context, actions) || actions;
  actions = normalizeGuardianAutoattacks(context, actions);
  return finalizeGuardianActions(context, actions);
}
