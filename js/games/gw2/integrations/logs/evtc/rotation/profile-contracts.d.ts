import type {
  RotationActionIdentity,
  RotationProfessionProfile
} from '#gw2/integrations/logs/lib/rotation/profiles.js';

/** Leaf contracts let EVTC profile contributors describe evidence without importing their composition root. */
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
