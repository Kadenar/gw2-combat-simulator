import type {
  ScheduledTask,
  SchedulerRecord,
  SchedulerState,
  SimulationEvent,
  SimulationEventInput,
  SkillId
} from '#gw2/platform/engine/types.js';
import type {
  MesmerClone,
  MesmerExpectedProcCandidate
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type {
  MesmerPendingResource,
  MesmerResourceDefinition
} from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import type { MesmerChronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/types.js';
import type { MesmerMirageMirror, MesmerMirageState } from '#gw2/professions/mesmer/specializations/mirage/types.js';
import type {
  MesmerVirtuosoExpectedProcCandidate,
  MesmerVirtuosoState
} from '#gw2/professions/mesmer/specializations/virtuoso/types.js';
import type {
  MesmerProjectedInstrument,
  MesmerTroubadourState
} from '#gw2/professions/mesmer/specializations/troubadour/types.js';

export type {
  MesmerPendingResource,
  MesmerResourceCause,
  MesmerResourceDefinition
} from '#gw2/professions/mesmer/core/mechanics/resource-types.js';

export interface MesmerAvailableFlip {
  readonly availableAt: number;
  readonly expiresAt: number;
  readonly persistent?: boolean;
}

/** Core owns state present for every specialization runtime. */
export interface MesmerCoreState {
  clones: MesmerClone[];
  pendingResources: MesmerPendingResource[];
  trackedSkillHits: Record<string, number[]>;
  traitReadyAt: Record<string, number>;
  counterspellAvailable: boolean;
  availableFlips: Record<string, MesmerAvailableFlip>;
  autoattackChains: Record<string, SkillId>;
  sharperImagesProgress: number;
  masterFencerProgress: number;
  ineptitudeReadyAt: number;
  clarityUntil: number;
  hasExplicitCombatStart: boolean;
  combatStartTime: number;
}

export interface MesmerProfessionState
  extends MesmerCoreState, MesmerChronomancerState, MesmerMirageState, MesmerVirtuosoState, MesmerTroubadourState {}

export interface MesmerRuntimeState {
  core: MesmerCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Chronomancer'; state: MesmerChronomancerState }
    | { kind: 'Mirage'; state: MesmerMirageState }
    | { kind: 'Virtuoso'; state: MesmerVirtuosoState }
    | { kind: 'Troubadour'; state: MesmerTroubadourState };
}

export interface MesmerResolverState {
  ineptitudeReadyAt: number;
}

export interface MesmerStateSnapshot {
  cloneCount: number;
  numericResource: number;
  instruments: [string, number][];
  continuumActive: boolean;
  counterspellAvailable: boolean;
  availableFlips: [string, MesmerAvailableFlip][];
  autoattackChains: [string, SkillId][];
  nextForgeAt: number;
  bloodsongProgress: number;
  sharperImagesProgress: number;
  masterFencerProgress: number;
  ineptitudeReadyAt: number;
  clarityUntil: number;
  ambushUntil: number;
  mirrors: MesmerMirageMirror[];
  riddleOfSandReady: boolean;
  timeBombUntil: number;
}

export type MesmerState = SchedulerState<MesmerRuntimeState> | Pick<MesmerProfessionState, 'clones'>;

export interface MesmerProjectedFlip {
  readonly availableAt: number;
  readonly expiresAt: number | null;
  readonly remaining: number | null;
  readonly persistent: boolean;
}

export interface MesmerEndState extends SchedulerRecord {
  readonly resource: number;
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly clarityRemaining: number;
  readonly counterspellAvailable: boolean;
  readonly availableAmbush: {
    readonly name: string;
    readonly source: string;
    readonly expiresAt: number;
    readonly remaining: number;
  } | null;
  readonly availableMirrors?: number;
  readonly activeInstruments?: readonly MesmerProjectedInstrument[];
  readonly availableFlips: Readonly<Record<string, MesmerProjectedFlip>>;
  readonly autoattackChains: Readonly<Record<string, SkillId>>;
  readonly continuumActive: boolean;
  readonly continuumRemaining: number;
}

export interface MesmerSchedulerTaskPayloads {
  readonly cloneAttack: { readonly cloneId: number };
  readonly partyBuff: { readonly event: SimulationEventInput };
  readonly resourceGain: MesmerPendingResource;
  readonly expectedProc: MesmerExpectedProcCandidate;
  readonly trackedHit: { readonly skillId: SkillId };
  readonly virtuosoExpectedProc: MesmerVirtuosoExpectedProcCandidate;
  readonly deadlyBladesCritical: { readonly event: Extract<SimulationEvent, { readonly type: 'damage' }> };
  readonly chaoticInterruption: { readonly skillId: SkillId; readonly skillName: string };
  readonly bladeSpend: {
    readonly reservationId: string;
    readonly sourceSkill: string;
    readonly rotationIndex: number;
  };
  readonly continuumExpire: { readonly expiresAt: number };
  readonly infiniteForge: SchedulerRecord;
  readonly signetIllusionsPassive: SchedulerRecord;
}

export type MesmerSchedulerTask<TPayload extends keyof MesmerSchedulerTaskPayloads> = Omit<
  ScheduledTask<MesmerSchedulerTaskPayloads[TPayload]>,
  'payload'
> & {
  readonly payload: MesmerSchedulerTaskPayloads[TPayload];
};
