import { ROTATION_PROFILES } from '#gw2/integrations/logs/lib/rotation/profiles.js';
import { elementalistProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/elementalist/profile.js';
import { engineerProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/engineer/profile.js';
import { guardianProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/guardian/profile.js';
import { mesmerProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/profile.js';
import { necromancerProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/necromancer/profile.js';
import { rangerProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/profile.js';
import { revenantProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/revenant/profile.js';
import { thiefProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/thief/profile.js';
import { warriorProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/warrior/profile.js';
import type {
  EvtcProfessionProfileSource,
  EvtcRotationProfessionProfile
} from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';

export type {
  EvtcProfessionProfileSource,
  EvtcRotationActionIdentity,
  EvtcRotationBuffTransition,
  EvtcRotationInitialSummon,
  EvtcRotationProfessionProfile
} from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';

const sourceConfigurations: readonly EvtcProfessionProfileSource[] = [
  elementalistProfileSource,
  mesmerProfileSource,
  necromancerProfileSource,
  rangerProfileSource,
  thiefProfileSource,
  engineerProfileSource,
  guardianProfileSource,
  warriorProfileSource,
  revenantProfileSource
];

const configurationByProfession = new Map(
  sourceConfigurations.map((configuration) => [configuration.professionId, configuration])
);

/** Adds EVTC-only evidence configuration to the shared profession inventory. */
export const EVTC_ROTATION_PROFILES: readonly EvtcRotationProfessionProfile[] = Object.freeze(
  ROTATION_PROFILES.map((profile) => {
    const source = configurationByProfession.get(profile.professionId);
    return Object.freeze({
      ...profile,
      ignoredInstantSkillIds: new Set(source?.ignoredInstantSkillIds || []),
      buffTransitions: Object.freeze([
        ...(source?.buffTransitions || []),
        ...(source?.buffTransitionsBySpecialization?.[profile.specializationId] || [])
      ]),
      initialSummons: Object.freeze([
        ...(source?.initialSummons || []),
        ...(source?.initialSummonsBySpecialization?.[profile.specializationId] || [])
      ]),
      inferCombatStartFromFirstCast: source?.inferCombatStartFromFirstCast === true
    });
  })
);

const profilesById = new Map(
  EVTC_ROTATION_PROFILES.map((profile) => [`${profile.professionId}:${profile.specializationId}`, profile])
);

export function evtcRotationProfile(
  professionId: string,
  specializationId: string
): EvtcRotationProfessionProfile | null {
  return profilesById.get(`${professionId}:${specializationId}`) || null;
}

/** Coalesces duplicate buff and weapon-swap signals for both player evidence and transition reconstruction. */
export const TRANSITION_WINDOW_MS = 150;
