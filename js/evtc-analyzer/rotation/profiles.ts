import type { SkillId } from '../../platform/engine/types.js';
import { elementalistProfileSource } from './professions/elementalist/profile.js';
import { engineerProfileSource } from './professions/engineer/profile.js';
import { guardianProfileSource } from './professions/guardian/profile.js';
import { mesmerProfileSource } from './professions/mesmer/profile.js';
import { necromancerProfileSource } from './professions/necromancer/profile.js';
import { rangerProfileSource } from './professions/ranger/profile.js';
import { thiefProfileSource } from './professions/thief/profile.js';
import { revenantProfileSource } from './professions/revenant/profile.js';
import { warriorProfileSource } from './professions/warrior/profile.js';

export interface EvtcRotationActionIdentity {
  readonly name: string;
  readonly skillId: SkillId;
}

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

export interface EvtcRotationProfessionProfile {
  readonly professionId: string;
  readonly professionName: string;
  readonly specializationId: string;
  readonly specializationName: string;
  readonly dodge: EvtcRotationActionIdentity;
  readonly weaponSwap: EvtcRotationActionIdentity;
  readonly skillNameAliases: Readonly<Record<string, string>>;
  readonly skillIdAliases: Readonly<Record<number, SkillId>>;
  readonly ignoredInstantSkillIds: ReadonlySet<number>;
  readonly buffTransitions: readonly EvtcRotationBuffTransition[];
  readonly initialSummons: readonly EvtcRotationInitialSummon[];
  readonly inferCombatStartFromFirstCast: boolean;
}

export interface ProfessionProfileSource {
  readonly id: string;
  readonly name: string;
  readonly specializations: Readonly<Record<string, string>>;
  readonly dodgeId?: SkillId;
  readonly dodgeBySpecialization?: Readonly<Record<string, EvtcRotationActionIdentity>>;
  readonly aliases?: Readonly<Record<string, string>>;
  readonly skillIdAliasesBySpecialization?: Readonly<Record<string, Readonly<Record<number, SkillId>>>>;
  readonly ignoredInstantSkillIds?: readonly number[];
  readonly buffTransitions?: readonly EvtcRotationBuffTransition[];
  readonly buffTransitionsBySpecialization?: Readonly<Record<string, readonly EvtcRotationBuffTransition[]>>;
  readonly initialSummons?: readonly EvtcRotationInitialSummon[];
  readonly initialSummonsBySpecialization?: Readonly<Record<string, readonly EvtcRotationInitialSummon[]>>;
  readonly inferCombatStartFromFirstCast?: boolean;
}

const sources: readonly ProfessionProfileSource[] = [
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

function aliasesFor(source: ProfessionProfileSource, specializationId: string): Readonly<Record<string, string>> {
  const aliases = { ...(source.aliases || {}) };
  if (specializationId !== 'mirage') delete aliases.dodge;
  return Object.freeze(aliases);
}

export const EVTC_ROTATION_PROFILES: readonly EvtcRotationProfessionProfile[] = Object.freeze(
  sources.flatMap((source) =>
    Object.entries(source.specializations).map(([specializationId, specializationName]) =>
      Object.freeze({
        professionId: source.id,
        professionName: source.name,
        specializationId,
        specializationName,
        dodge:
          source.dodgeBySpecialization?.[specializationId] ||
          Object.freeze({
            name: 'Dodge',
            skillId: source.dodgeId ?? -5
          }),
        weaponSwap: Object.freeze({
          name: 'Swap Weapons',
          skillId: -3
        }),
        skillNameAliases: aliasesFor(source, specializationId),
        skillIdAliases: Object.freeze({
          ...(source.skillIdAliasesBySpecialization?.[specializationId] || {})
        }),
        ignoredInstantSkillIds: new Set(source.ignoredInstantSkillIds || []),
        buffTransitions: Object.freeze([
          ...(source.buffTransitions || []),
          ...(source.buffTransitionsBySpecialization?.[specializationId] || [])
        ]),
        initialSummons: Object.freeze([
          ...(source.initialSummons || []),
          ...(source.initialSummonsBySpecialization?.[specializationId] || [])
        ]),
        inferCombatStartFromFirstCast: source.inferCombatStartFromFirstCast === true
      })
    )
  )
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
