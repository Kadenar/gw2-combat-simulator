import { EVTC_STATE_CHANGE } from '../../../types.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import {
  assembleRevenantActions,
  firstActionAnchor,
  initialEnchantedDaggersActions,
  recoverRevenantPrecastActions
} from './common.js';
import { directAction, rawSkillName, runtimeDuration, type RevenantActionIdentity } from './shared.js';

const FACET_BUFF_ACTIONS = new Map<number, RevenantActionIdentity>([
  [27336, { name: 'Facet of Light', skillId: 27220 }],
  [28036, { name: 'Facet of Darkness', skillId: 28379 }],
  [28243, { name: 'Facet of Elements', skillId: 27014 }],
  [27376, { name: 'Facet of Strength', skillId: 26644 }],
  [27983, { name: 'Facet of Chaos', skillId: 27760 }],
  [29275, { name: 'Facet of Nature', skillId: 29371 }]
]);

const INITIAL_FACETS: readonly RevenantActionIdentity[] = Object.freeze([
  { name: 'Facet of Light', skillId: 27220 },
  { name: 'Facet of Darkness', skillId: 28379 },
  { name: 'Facet of Elements', skillId: 27014 },
  { name: 'Facet of Strength', skillId: 26644 },
  { name: 'Facet of Chaos', skillId: 27760 },
  { name: 'Facet of Nature', skillId: 29371 }
]);

function facetActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  return context.log.events.flatMap((event, eventIndex) => {
    const identity = FACET_BUFF_ACTIONS.get(event.skillId);
    if (
      !identity ||
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY
    ) {
      return [];
    }
    return [directAction(eventIndex, event.time, event.skillId, rawSkillName(context, event.skillId), identity)];
  });
}

function initialFacetActions(
  context: EvtcProfessionReconstructionContext,
  anchor: number
): EvtcRecordedRotationAction[] {
  if (
    !Number.isFinite(anchor) ||
    !context.log.events.some(
      (event) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
        rawSkillName(context, event.skillId) === 'Legendary Dragon Stance'
    )
  ) {
    return [];
  }
  let cursor = anchor;
  const reversed: EvtcRecordedRotationAction[] = [];
  for (let index = INITIAL_FACETS.length - 1; index >= 0; index -= 1) {
    const identity = INITIAL_FACETS[index];
    const duration = runtimeDuration(context, identity);
    cursor -= duration;
    reversed.push({
      ...directAction(-5000 + index, cursor, identity.skillId, identity.name, identity, 'initial-state', duration),
      precast: true
    });
  }
  return reversed.reverse();
}

export function reconstructHeraldActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const recoveredPrecasts = recoverRevenantPrecastActions(context);
  const anchor = firstActionAnchor(context, recoveredPrecasts);
  return assembleRevenantActions(context, {
    initialActions: [...initialEnchantedDaggersActions(context, anchor), ...initialFacetActions(context, anchor)],
    recoveredPrecasts,
    beforeUpkeepActions: facetActions(context)
  });
}
