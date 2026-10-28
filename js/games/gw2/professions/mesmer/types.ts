import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { MechanicCombatContext, MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';

import type { Gw2Build, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { StrikeEffect } from '#gw2/platform/effects/types.js';
import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { AmmoObservation } from '#gw2/platform/execution/cooldown-contracts.js';
import type { MesmerResourceSpendDetails } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import type {
  MesmerShatterResolution,
  MesmerShatterResolverRequest,
  MesmerShatterTraitHit
} from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import type { MesmerCoreState } from '#gw2/professions/mesmer/core/state.js';
import type { MesmerChronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import type { MesmerMirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import type { MesmerTroubadourState } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerVirtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';

import type { ConditionEffect } from '#gw2/platform/effects/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export interface MesmerRuntimeState {
  core: MesmerCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Chronomancer'; state: MesmerChronomancerState }
    | { kind: 'Mirage'; state: MesmerMirageState }
    | { kind: 'Virtuoso'; state: MesmerVirtuosoState }
    | { kind: 'Troubadour'; state: MesmerTroubadourState };
}

/** Public consumers receive only the ID/value pairs published by active owners. */
export type MesmerPlanningState = ReturnType<
  typeof import('#gw2/professions/mesmer/core/state.js').projectMesmerCorePlanningState
> &
  ReturnType<
    typeof import('#gw2/professions/mesmer/specializations/chronomancer/state.js').projectChronomancerPlanningState
  > &
  ReturnType<typeof import('#gw2/professions/mesmer/specializations/mirage/state.js').projectMiragePlanningState> &
  ReturnType<
    typeof import('#gw2/professions/mesmer/specializations/troubadour/state.js').projectTroubadourPlanningState
  > &
  ReturnType<typeof import('#gw2/professions/mesmer/specializations/virtuoso/state.js').projectVirtuosoPlanningState>;

interface MesmerSpecializationSelection {
  readonly name: string;
  readonly traits?: string;
}

export interface MesmerBuild extends Gw2Build {
  specializations?: MesmerSpecializationSelection[];
}

export interface MesmerCanonicalBuild extends Gw2CanonicalBuild {
  initialResource: number;
}

/** Prepared family-wide simulation input after build normalization. */
export interface MesmerConfig extends Gw2Config {
  readonly specialization: string;
  readonly primaryWeapon: string;
}

export type MesmerResolverContext = MechanicCombatContext & {
  config: Gw2Config;
  profession: MesmerRuntimeState;
};

export type MesmerResolverEvent = Gw2ResolverEvent & {
  readonly count?: number;
  readonly conversionTimes?: readonly number[];
};

/** Mesmer owners mutate their profession state and request shared changes through engine services. */
export type MesmerRuntime = MechanicContext<MesmerRuntimeState, MesmerSkill>;

export type MesmerUiState = Partial<MesmerPlanningState>;

export interface MesmerUiContext extends Omit<ProfessionUiCallbackContext<MesmerUiState>, 'build'> {
  readonly config?: Partial<MesmerConfig>;
  readonly build?: Partial<MesmerBuild> | null;
}

/** UI slice whose callbacks read Mesmer end-state projections. */
export type MesmerUiSlice = Partial<ProfessionUiContract<MesmerUiState>>;

/** Adds ambush damage and status scheduling to the shared strike definition. */
export interface MesmerAmbushStrike extends Partial<StrikeEffect> {
  readonly damageAtMs?: number;
  /** Repeated statuses retain their cadence when their sibling strike is removed. */
  readonly statusAtMs?: readonly number[];
  readonly conditions?: readonly ConditionEffect[];
  readonly boons?: readonly import('#gw2/platform/effects/types.js').StatusEffect[];
}

/** A catalog skill also supplies the player and clone variants used by the Mirage controller. */
export interface MesmerAmbushAttack extends MesmerSkill {
  /** Whether this skill owns a separately removable Vulnerability template. */
  readonly hasVulnerability?: boolean;
  readonly player: MesmerAmbushStrike;
  readonly clone: MesmerAmbushStrike;
  readonly vulnerability?: {
    readonly duration: number;
    readonly stacks: number;
  };
}

/**
 * Adds instrument identity and companion conditions to the shared strike definition.
 * Inherited persistsAfterInterrupt lets launched performance packets outlive interruption after commitment.
 */
export interface MesmerInstrument extends Partial<StrikeEffect> {
  /** Harp intentionally has no native strike; other instruments retain their named strike owner after removal. */
  readonly hasStrike?: boolean;
  readonly slot: number;
  readonly instrument: string;
  readonly damageAtMs?: number;
  readonly conditions?: readonly ConditionEffect[];
}

export type MesmerShatterResolver = (
  context: MesmerRuntime,
  request: MesmerShatterResolverRequest
) => readonly MesmerShatterTraitHit[];

export type MesmerActivePrimaryWeapon = () => string;

export interface MesmerProfessionActionController {
  commitReservedResources(at: number, reserved: number, details?: MesmerResourceSpendDetails): number;
  consumeResources(at: number, details?: MesmerResourceSpendDetails): number;
  currentResource(): number;
  handleShatter(
    context: MesmerRuntime,
    skill: MesmerSkill,
    at: number,
    resourcesSpent?: number | null,
    castStart?: number,
    packetAt?: number,
    delivery?: EffectDelivery
  ): MesmerShatterResolution | null;
  reserveResources(): number;
  restoreReservedResources(spent: number): void;
}

export type MesmerRefreshAmmo = (skill: MesmerSkill, at: number) => AmmoObservation | null;
