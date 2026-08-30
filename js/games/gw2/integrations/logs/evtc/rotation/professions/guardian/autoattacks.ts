import { findRotationSkill } from '#gw2/integrations/logs/evtc/rotation/catalog.js';
import { committedActionsFromStrikePackets } from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { isFirebrandTomeActionId } from '#gw2/integrations/logs/evtc/rotation/professions/guardian/firebrand.js';
import { SWAP_WEAPONS } from '#gw2/integrations/logs/evtc/rotation/professions/guardian/shared.js';

const MAX_AUTOATTACK_IMPACT_MS = 1500;
const AUTOATTACK_CHAINS = Object.freeze([
  Object.freeze([
    Object.freeze({ name: 'Strike', skillId: 9137 }),
    Object.freeze({ name: 'Vengeful Strike', skillId: 9138 }),
    Object.freeze({ name: 'Wrathful Strike', skillId: 9139 })
  ]),
  Object.freeze([
    Object.freeze({ name: 'Core Cleave', skillId: 45047 }),
    Object.freeze({ name: 'Bleeding Edge', skillId: 44602 }),
    Object.freeze({ name: 'Searing Slash', skillId: 43826 })
  ])
]);

function isAutoattack(context: EvtcProfessionReconstructionContext, action: EvtcRecordedRotationAction): boolean {
  const skill = findRotationSkill(
    action.canonicalSkillId ?? action.rawSkillId,
    action.canonicalName ?? action.rawName,
    context.catalog,
    context.profile
  );
  return String(skill?.slot || '').toLowerCase() === 'weapon_1';
}

function resetsAutoattackChain(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction
): boolean {
  if (action.rawName === SWAP_WEAPONS.name) return true;
  const skill = findRotationSkill(
    action.canonicalSkillId ?? action.rawSkillId,
    action.canonicalName ?? action.rawName,
    context.catalog,
    context.profile
  );
  const canonicalSkillId = Number(action.canonicalSkillId ?? action.rawSkillId);
  return (
    Number(skill?.castTimeMs || 0) > 0 ||
    skill?.handlerId === 'guardian.radiant-forge' ||
    skill?.handlerId === 'guardian.stow-tome' ||
    isFirebrandTomeActionId(canonicalSkillId)
  );
}

function normalizeAutoattackChains(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const positions = new Map<number, { readonly chainIndex: number; readonly actionIndex: number }>();
  AUTOATTACK_CHAINS.forEach((chain, chainIndex) => {
    chain.forEach((identity, actionIndex) => {
      positions.set(identity.skillId, { chainIndex, actionIndex });
    });
  });
  let activeChainIndex: number | null = null;
  let expectedActionIndex = 0;
  return [...actions]
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex)
    .map((action) => {
      const position = positions.get(action.rawSkillId);
      if (!position) {
        if (resetsAutoattackChain(context, action)) {
          activeChainIndex = null;
          expectedActionIndex = 0;
        }

        return action;
      }

      const actionIndex = activeChainIndex === position.chainIndex ? expectedActionIndex : 0;
      const chain = AUTOATTACK_CHAINS[position.chainIndex];
      const identity = chain[actionIndex];
      if (action.status === 'completed' && actionIndex < chain.length - 1) {
        activeChainIndex = position.chainIndex;
        expectedActionIndex = actionIndex + 1;
      } else {
        activeChainIndex = null;
        expectedActionIndex = 0;
      }

      return {
        ...action,
        canonicalSkillId: identity.skillId,
        canonicalName: identity.name
      };
    });
}

function removeUncommittedAutoattacks(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const autoattacks = actions.filter((action) => isAutoattack(context, action));
  const committed = committedActionsFromStrikePackets(context, autoattacks, {
    maxFallbackImpactMs: MAX_AUTOATTACK_IMPACT_MS
  });
  return actions.filter((action) => !isAutoattack(context, action) || committed.has(action));
}

export function normalizeGuardianAutoattacks(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return normalizeAutoattackChains(context, removeUncommittedAutoattacks(context, actions));
}
