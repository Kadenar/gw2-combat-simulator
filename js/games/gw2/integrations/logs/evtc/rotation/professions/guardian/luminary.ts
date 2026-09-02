import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { firstStrikePacketOffsetMs } from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import type { EvtcRotationBuffTransition } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import {
  isPhysicalWeaponSwap,
  recordedDuration,
  skillFor,
  SWAP_WEAPONS
} from '#gw2/integrations/logs/evtc/rotation/professions/guardian/shared.js';
import { EPSILON } from '#kernel/core/clock.js';

const ENTER_RADIANT_FORGE = Object.freeze({
  name: 'Enter Radiant Forge',
  skillId: 77073
});
const EXIT_RADIANT_FORGE = Object.freeze({
  name: 'Exit Radiant Forge',
  skillId: 76616
});
const RADIANT_COURAGE = Object.freeze({
  name: 'Radiant Courage',
  skillId: 78358
});
const RADIANT_FORGE_BUFF = 77142;
const LIGHT_AURA_BUFF = 25518;
const EMPOWERED_ARMAMENTS_BUFF = 77169;
const RADIANT_HAMMER_BUFF = 77360;
const RELIC_OF_THE_CLAW_BUFF = 73955;
const SYMBOL_OF_LUMINANCE = Object.freeze({
  name: 'Symbol of Luminance',
  skillId: 73132
});
const OPENING_RADIANT_WEAPONS = Object.freeze([
  Object.freeze({ name: 'Luminous Staff', skillId: 76708 }),
  Object.freeze({ name: 'Radiant Bulwark', skillId: 77197 }),
  Object.freeze({ name: 'Dazzling Hammer', skillId: 77339 })
]);
const OFF_TARGET_OPENING_SKILL_IDS = new Set([76708, 77339]);

export const LUMINARY_BUFF_TRANSITIONS: readonly EvtcRotationBuffTransition[] = [
  {
    buffSkillId: RADIANT_FORGE_BUFF,
    gain: ENTER_RADIANT_FORGE,
    loss: EXIT_RADIANT_FORGE,
    suppressWeaponSwap: true
  },
  {
    buffSkillId: 77821,
    loss: { name: 'Radiant Justice', skillId: 78837 },
    lossRequiresRemainingDuration: true,
    suppressWeaponSwap: false
  },
  {
    buffSkillId: 77855,
    loss: { name: 'Radiant Resolve', skillId: 78514 },
    lossRequiresRemainingDuration: true,
    suppressWeaponSwap: false
  },
  {
    buffSkillId: 77893,
    loss: RADIANT_COURAGE,
    lossRequiresRemainingDuration: true,
    suppressWeaponSwap: false
  },
  {
    buffSkillId: 77095,
    gain: { name: 'Effulgent Stance', skillId: 76813 },
    suppressWeaponSwap: false
  }
];

function initialSelfBuffs(context: EvtcProfessionReconstructionContext, skillId: number) {
  return context.log.events.filter(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.skillId === skillId &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
      event.value > 0
  );
}

/** Rebuilds the omitted Forge setup only when its three weapon uses and final hammer state survive in the snapshot. */
function inferOpeningForgePrecast(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const opening = actions.find(
    (action) =>
      action.precast === true &&
      (action.rawSkillId === SYMBOL_OF_LUMINANCE.skillId ||
        action.rawName.trim().toLowerCase() === SYMBOL_OF_LUMINANCE.name.toLowerCase())
  );
  if (
    !opening ||
    initialSelfBuffs(context, EMPOWERED_ARMAMENTS_BUFF).length < OPENING_RADIANT_WEAPONS.length ||
    !initialSelfBuffs(context, LIGHT_AURA_BUFF).length ||
    !initialSelfBuffs(context, RADIANT_HAMMER_BUFF).length ||
    !initialSelfBuffs(context, RELIC_OF_THE_CLAW_BUFF).length ||
    actions.some(
      (action) =>
        action.start <= opening.start &&
        (action.canonicalSkillId === ENTER_RADIANT_FORGE.skillId || action.rawSkillId === ENTER_RADIANT_FORGE.skillId)
    )
  ) {
    return [];
  }

  const identities = [ENTER_RADIANT_FORGE, ...OPENING_RADIANT_WEAPONS, EXIT_RADIANT_FORGE];
  let cursor = opening.start;
  const reversed: EvtcRecordedRotationAction[] = [];
  for (let index = identities.length - 1; index >= 0; index -= 1) {
    const identity = identities[index];
    const duration = recordedDuration(context, identity);
    cursor -= duration;
    reversed.push({
      start: cursor,
      end: cursor + duration,
      expectedDuration: duration,
      rawSkillId: identity.skillId,
      rawName: identity.name,
      canonicalSkillId: identity.skillId,
      canonicalName: identity.name,
      evidence: 'initial-state',
      status: duration > 0 ? 'completed' : 'instant',
      eventIndex: opening.eventIndex - identities.length + index,
      precast: true,
      ...(OFF_TARGET_OPENING_SKILL_IDS.has(identity.skillId) ? { offTarget: true } : {})
    });
  }

  return reversed.reverse();
}

function alignOpeningSymbolCombatStart(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const sourceCombatStart = context.log.events.find(
    (event) => event.source === context.playerAddress && event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT
  )?.time;
  const strikeOffset = firstStrikePacketOffsetMs(skillFor(context, SYMBOL_OF_LUMINANCE), undefined, {
    explicitOnly: true
  });
  if (sourceCombatStart == null || strikeOffset == null) return [...actions];
  const opening = actions
    .filter(
      (action) =>
        (action.rawSkillId === SYMBOL_OF_LUMINANCE.skillId ||
          action.rawName.trim().toLowerCase() === SYMBOL_OF_LUMINANCE.name.toLowerCase()) &&
        action.start <= sourceCombatStart &&
        sourceCombatStart <= action.end
    )
    .sort((left, right) => right.start - left.start)[0];
  if (!opening) return [...actions];
  const firstStrikeAt = opening.start + strikeOffset;
  if (firstStrikeAt >= sourceCombatStart) return [...actions];
  // EVTC millisecond timestamps may place ENTER_COMBAT just after the modeled opening packet;
  // retain the preceding source millisecond so both same-time Symbol strikes remain observable.
  const combatStartOverride = Math.max(opening.start, firstStrikeAt - Math.ceil(EPSILON * 1_000));
  return actions.map((action) => (action === opening ? { ...action, combatStartOverride } : action));
}

export function normalizeLuminaryWeaponTransitions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return actions.flatMap((action) => {
    if (action.rawName !== SWAP_WEAPONS.name) return [action];
    if (!context.log.events[action.eventIndex]) return [];
    return isPhysicalWeaponSwap(context, action) ? [action] : [];
  });
}

function alignInitialRadiantForge(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const initial = context.log.events.find(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.skillId === RADIANT_FORGE_BUFF &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
      event.buffDamage > event.value
  );
  if (!initial) return [...actions];
  const start = initial.time - (initial.buffDamage - initial.value);
  return actions.map((action) =>
    action.initialState === true && action.canonicalSkillId === 77073 && action.start !== start
      ? { ...action, start, end: start }
      : action
  );
}

export function reconstructLuminaryActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  // Buff snapshots are evidence for omitted player inputs, not standalone casts.
  const aligned = alignOpeningSymbolCombatStart(context, alignInitialRadiantForge(context, actions));
  return [...inferOpeningForgePrecast(context, aligned), ...aligned];
}
