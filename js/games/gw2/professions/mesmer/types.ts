import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { MechanicCombatContext, MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';

import type { Gw2Build, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { StrikeEffect, StrikeTick } from '#gw2/platform/effects/types.js';
import type { SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

import type { AmmoObservation } from '#gw2/platform/execution/cooldown-contracts.js';
import type {
  MesmerResourceDefinition,
  MesmerResourceSpendDetails
} from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import type {
  MesmerShatterResolution,
  MesmerShatterResolverRequest,
  MesmerShatterTraitHit
} from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import type { MesmerCoreState } from '#gw2/professions/mesmer/core/state.js';
import type { MesmerChronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import type { MesmerMirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import type { MesmerTroubadourState } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerProjectedInstrument } from '#gw2/professions/mesmer/specializations/troubadour/types.js';
import type { MesmerVirtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';

import type { ConditionEffect } from '#gw2/platform/effects/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
interface MesmerProfessionState
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

interface MesmerPlanningState {
  readonly endurance?: ResourceClock;
  readonly resource?: number;
  readonly resourceDefinition?: MesmerResourceDefinition;
  readonly clarityRemaining: number;
  readonly availableAmbush?: {
    readonly name: string;
    readonly source: string;
    readonly expiresAt: number;
    readonly remaining: number;
  } | null;
  readonly activeInstruments?: readonly MesmerProjectedInstrument[];
  readonly availableFlips: Readonly<SkillFlipWindows>;
  readonly autoattackChains: Readonly<Record<string, SkillId>>;
  readonly continuumActive?: boolean;
  readonly continuumRemaining?: number;
}

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

/** UI callbacks read both live state and the named public projection fields. */
export type MesmerUiState = Partial<MesmerProfessionState> &
  Partial<Omit<MesmerPlanningState, keyof MesmerProfessionState>>;

export interface MesmerUiContext extends Omit<ProfessionUiCallbackContext<MesmerUiState>, 'build'> {
  readonly config?: Partial<MesmerConfig>;
  readonly build?: Partial<MesmerBuild> | null;
}

/** UI slice whose callbacks read Mesmer end-state projections. */
export type MesmerUiSlice = Partial<ProfessionUiContract<Partial<MesmerProfessionState>>>;

export interface MesmerAmbushStrike extends Partial<StrikeEffect> {
  readonly coefficient?: number;
  readonly hits?: number;
  readonly atMs?: number;
  readonly castTimeMs?: number;
  readonly damageAtMs?: number;
  /** Repeated statuses retain their cadence when their sibling strike is removed. */
  readonly statusAtMs?: readonly number[];
  readonly ticks?: readonly StrikeTick[];
  readonly conditions?: readonly ConditionEffect[];
  readonly boons?: readonly import('#gw2/platform/effects/types.js').StatusEffect[];
}

/** A catalog skill also supplies the player and clone variants used by the Mirage controller. */
export interface MesmerAmbushAttack extends MesmerSkill {
  readonly balanceProfileId?: SkillId;
  readonly player: MesmerAmbushStrike;
  readonly clone: MesmerAmbushStrike;
  readonly vulnerability?: {
    readonly duration: number;
    readonly stacks: number;
  };
}

export interface MesmerInstrument extends Partial<StrikeEffect> {
  readonly balanceProfileId?: SkillId;
  readonly slot: number;
  readonly instrument: string;
  readonly coefficient?: number;
  readonly hits?: number;
  readonly damageAtMs?: number;
  /** Launched performance packets can outlive an interruption after the skill's commit point. */
  readonly persistsAfterInterrupt?: boolean;
  readonly ticks?: readonly StrikeTick[];
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
