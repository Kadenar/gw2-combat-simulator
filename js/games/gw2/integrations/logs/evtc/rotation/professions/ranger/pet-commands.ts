import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { rangerPetSkillCommandable } from '#gw2/professions/ranger/data/pet-commands.js';

const PET_MARKER_TOLERANCE_MS = 50;

/** Use the owned pet's animation for each command and retain player markers for casts the pet log missed. */
export function selectRangerPetCommands({
  log,
  evidence,
  playerAddress,
  catalog,
  profile,
  recordedActions
}: EvtcProfessionReconstructionContext): readonly EvtcRecordedRotationAction[] {
  if (profile.specializationId === 'soulbeast' || !catalog) return recordedActions;

  const petCasts = log.agents
    .filter((agent) => agent.elite === 0xffffffff && evidence.owners.get(agent.address) === playerAddress)
    .flatMap((agent) => evidence.animationsFor(agent.address))
    .filter((cast) => rangerPetSkillCommandable(catalog.skillsById.get(cast.rawSkillId), profile.specializationName));

  if (!petCasts.length) return recordedActions;

  const playerCasts = recordedActions.filter(
    (action) =>
      !petCasts.some(
        (pet) =>
          pet.rawSkillId === action.rawSkillId &&
          action.start >= pet.start - PET_MARKER_TOLERANCE_MS &&
          action.start <= pet.end + PET_MARKER_TOLERANCE_MS
      )
  );
  return [...playerCasts, ...petCasts];
}
