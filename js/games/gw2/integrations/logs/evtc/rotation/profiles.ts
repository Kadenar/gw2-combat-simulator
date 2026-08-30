import {
  ROTATION_PROFILES,
  type RotationActionIdentity,
  type RotationProfessionProfile
} from '#gw2/integrations/logs/lib/rotation/profiles.js';
import { elementalistProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/elementalist/profile.js';
import { engineerProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/engineer/profile.js';
import { guardianProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/guardian/profile.js';
import { mesmerProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/profile.js';
import { necromancerProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/necromancer/profile.js';
import { rangerProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/profile.js';
import { revenantProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/revenant/profile.js';
import { thiefProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/thief/profile.js';
import { warriorProfileSource } from '#gw2/integrations/logs/evtc/rotation/professions/warrior/profile.js';

export type EvtcRotationActionIdentity = RotationActionIdentity;

export interface EvtcRotationBuffTransition {
  readonly buffSkillId: number;
  readonly gain?: EvtcRotationActionIdentity;
  readonly loss?: EvtcRotationActionIdentity;
  readonly lossRequiresRemainingDuration?: boolean;
  readonly suppressWeaponSwap: boolean;
}

export interface EvtcRotationInitialSummon {
  readonly agentSpeciesId: number;
  readonly action: EvtcRotationActionIdentity;
}

export interface EvtcRotationProfessionProfile extends RotationProfessionProfile {
  readonly ignoredInstantSkillIds: ReadonlySet<number>;
  readonly buffTransitions: readonly EvtcRotationBuffTransition[];
  readonly initialSummons: readonly EvtcRotationInitialSummon[];
  readonly inferCombatStartFromFirstCast: boolean;
}

export interface EvtcProfessionProfileSource {
  readonly professionId: string;
  readonly ignoredInstantSkillIds?: readonly number[];
  readonly buffTransitions?: readonly EvtcRotationBuffTransition[];
  readonly buffTransitionsBySpecialization?: Readonly<Record<string, readonly EvtcRotationBuffTransition[]>>;
  readonly initialSummons?: readonly EvtcRotationInitialSummon[];
  readonly initialSummonsBySpecialization?: Readonly<Record<string, readonly EvtcRotationInitialSummon[]>>;
  readonly inferCombatStartFromFirstCast?: boolean;
}

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
