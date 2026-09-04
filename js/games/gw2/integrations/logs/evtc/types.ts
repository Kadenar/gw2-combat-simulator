import type { RotationActionSummary, RotationPlayerIdentity } from '#gw2/integrations/logs/lib/rotation/model.js';

export const EVTC_STATE_CHANGE = Object.freeze({
  NONE: 0,
  ENTER_COMBAT: 1,
  EXIT_COMBAT: 2,
  CHANGE_DEAD: 4,
  WEAPON_SWAP: 11,
  BUFF_INITIAL: 18,
  MAP_ID: 25,
  ANIMATION_START: 67,
  ANIMATION_STOP: 68,
  BUFF_APPLY: 69,
  BUFF_CHANGE: 70,
  BUFF_REMOVE_SINGLE: 71,
  BUFF_REMOVE_ALL: 72,
  TRANSFORMATION: 73
} as const);

// arcdps cbtactivation: how a skill activation (cast) event was produced.
export const EVTC_ACTIVATION = Object.freeze({
  NONE: 0,
  START: 1, // activation_normal: cast started
  QUICKNESS: 2, // legacy, unused by current arcdps
  CANCEL_FIRE: 3, // stopped after reaching tooltip time (cast fired)
  CANCEL_CANCEL: 4, // stopped before firing (cast aborted)
  RESET: 5 // animation completed fully
} as const);

export interface ParsedEvtcHeader {
  readonly magic: 'EVTC';
  readonly arcdpsBuild: string;
  readonly revision: 0 | 1;
  readonly encounterId: number;
  readonly agentCount: number;
  readonly skillCount: number;
  readonly eventCount: number;
}

export interface ParsedEvtcAgent {
  readonly address: bigint;
  readonly profession: number;
  readonly elite: number;
  readonly toughness: number;
  readonly concentration: number;
  readonly healing: number;
  readonly condition: number;
  readonly character: string;
  readonly account: string;
  readonly subgroup: string;
}

export interface ParsedEvtcSkill {
  readonly id: number;
  readonly name: string;
}

export interface ParsedEvtcEvent {
  readonly time: number;
  readonly source: bigint;
  readonly target: bigint;
  readonly value: number;
  readonly buffDamage: number;
  readonly overstackValue: number;
  readonly skillId: number;
  readonly sourceInstance: number;
  readonly targetInstance: number;
  readonly sourceMasterInstance: number;
  readonly targetMasterInstance: number;
  readonly iff: number;
  readonly buff: number;
  readonly result: number;
  readonly activation: number;
  readonly buffRemove: number;
  readonly ninety: number;
  readonly fifty: number;
  readonly moving: number;
  readonly stateChange: number;
  readonly flanking: number;
  readonly shields: number;
  readonly offcycle: number;
  readonly pad: number;
}

export interface ParsedEvtc {
  readonly header: ParsedEvtcHeader;
  readonly agents: readonly ParsedEvtcAgent[];
  readonly skills: readonly ParsedEvtcSkill[];
  readonly events: readonly ParsedEvtcEvent[];
}

export type EvtcRotationEvidence =
  | 'animation'
  | 'legacy-activation'
  | 'effect'
  | 'resource-inference'
  | 'state-change'
  | 'buff-transition'
  | 'initial-state';

export interface EvtcRotationAction extends RotationActionSummary {
  readonly evidence: EvtcRotationEvidence;
  readonly weaponSet?: number | null;
  readonly doubleEdgeOutcome?: 'success' | 'backfire';
}

export interface EvtcRotationPlayer extends RotationPlayerIdentity {
  readonly address: string;
}
