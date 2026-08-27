import { normalizeNecromancerAutoattackChains } from './necromancer/autoattacks.js';
import { reconstructHarbingerActions } from './necromancer/harbinger.js';
import { reconstructReaperActions } from './necromancer/reaper.js';
import { reconstructRitualistActions } from './necromancer/ritualist.js';
import { reconstructScourgeActions } from './necromancer/scourge.js';
import { effectAction, initialSelfBuffCount } from './necromancer/shared.js';
import type {
  EvtcProfessionActionReconstructor,
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from './types.js';

const SOUL_BARBS_BUFF = 53489;
const SHROUD_PRECAST_WAIT_MS = 9000;
const SHROUD_PRECASTS: Readonly<Record<string, readonly { readonly name: string; readonly skillId: number }[]>> =
  Object.freeze({
    core: [
      { name: 'Death Shroud', skillId: 10574 },
      { name: 'End Death Shroud', skillId: 10585 }
    ],
    reaper: [
      { name: "Reaper's Shroud", skillId: 30792 },
      { name: "Exit Reaper's Shroud", skillId: 30961 }
    ],
    scourge: [{ name: 'Desert Shroud', skillId: 44663 }],
    harbinger: [
      { name: 'Harbinger Shroud', skillId: 62567 },
      { name: 'Exit Harbinger Shroud', skillId: 62540 }
    ],
    ritualist: [
      { name: "Ritualist's Shroud", skillId: 77238 },
      { name: "Exit Ritualist's Shroud", skillId: 76933 }
    ]
  });

const specializationReconstructors: ReadonlyMap<string, EvtcProfessionActionReconstructor> = new Map([
  ['harbinger', reconstructHarbingerActions],
  ['reaper', reconstructReaperActions],
  ['ritualist', reconstructRitualistActions],
  ['scourge', reconstructScourgeActions]
]);

/** Rebuilds the omitted shroud setup when Soul Barbs proves it completed before logging began. */
function shroudPrecastActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const identities = SHROUD_PRECASTS[context.profile.specializationId];
  if (!identities || !initialSelfBuffCount(context.log, context.playerAddress, SOUL_BARBS_BUFF)) return [];

  const at = context.timelineOriginMs - SHROUD_PRECAST_WAIT_MS;
  return identities.map((identity, index) => ({
    ...effectAction(-9000 + index, at, identity.skillId, identity.name, identity, 'initial-state'),
    precast: true
  }));
}

export function reconstructNecromancerProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const actions =
    specializationReconstructors.get(context.profile.specializationId)?.(context) || context.recordedActions;
  return normalizeNecromancerAutoattackChains(context, [...shroudPrecastActions(context), ...actions]);
}
