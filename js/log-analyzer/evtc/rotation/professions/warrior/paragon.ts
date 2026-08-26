import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { detectedWarriorCorePrecastIdentity, WARRIOR_CORE_ACTIONS } from './common.js';
import {
  combatStart,
  initialAction,
  playerInitialBuff,
  recordedDuration,
  sequentialInitialActions,
  type WarriorActionIdentity
} from './shared.js';

const CHANT_OF_ACTION = Object.freeze({
  name: 'Chant of Action',
  skillId: 77342
});
const CHANT_OF_ACTION_BUFF = 76865;

// ArcDPS has emitted multiple IDs for the same Paragon profession skills.
// Normalize them before catalog lookup so the replay uses one stable identity.
export const PARAGON_SKILL_ID_ALIASES = Object.freeze({
  69297: 45252,
  69433: 45252,
  80252: 80203,
  80263: 80203
});

/**
 * Reconstructs the Paragon opener from initial self-buffs when Bull's Charge
 * supplies a reliable combat-start anchor. Bull's Charge crosses EnterCombat
 * by one millisecond so it remains the opening attack; the preceding signets
 * and chant are packed backward in their known order.
 */
function paragonPrecasts(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const atCombat = combatStart(context);
  const bullsCharge = detectedWarriorCorePrecastIdentity(context, 'bullsCharge');
  if (atCombat == null || !bullsCharge) return [];

  const bullsDuration = recordedDuration(context, bullsCharge);
  const bullsStart = atCombat - Math.max(0, bullsDuration - 1);
  const identities: WarriorActionIdentity[] = [];
  const healing = detectedWarriorCorePrecastIdentity(context, 'healingSignet');
  const rage = detectedWarriorCorePrecastIdentity(context, 'signetOfRage');
  const fury = detectedWarriorCorePrecastIdentity(context, 'signetOfFury');
  if (healing) identities.push(healing);
  if (rage) identities.push(rage);
  if (playerInitialBuff(context, CHANT_OF_ACTION_BUFF)) {
    identities.push(CHANT_OF_ACTION);
  }

  if (fury) identities.push(fury);
  return [
    ...sequentialInitialActions(context, identities, bullsStart, -3000),
    initialAction(context, WARRIOR_CORE_ACTIONS.bullsCharge, bullsStart, -2990)
  ];
}

/** Prepends only the Paragon opening casts proven by the initial-state snapshot. */
export function reconstructParagonActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return [...paragonPrecasts(context), ...actions];
}
