import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { EffectMetadata } from '#gw2/platform/engine/events/events.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/actors.js';
import type { Gw2CanonicalBuild, Gw2Build } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { ProfessionTraitSelection } from '#gw2/professions/shared/trait-data.js';
import type { GuardianCoreState } from '#gw2/professions/guardian/core/state.js';
import type { GuardianDragonhunterState } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';
import type { GuardianFirebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { GuardianLuminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianWillbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
export interface GuardianBuild extends Gw2Build {
  specializations?: ProfessionTraitSelection[];
  assumptions?: { readonly quickness?: boolean };
}

export interface GuardianCanonicalBuild extends Gw2CanonicalBuild {
  initialTomePages: number;
}

export interface GuardianConfig extends Gw2Config {
  readonly maximumTomePages?: number;
  readonly initialTomePages?: number;
  readonly initialEndurance?: number;
  readonly specializations?: readonly (string | { readonly name?: string })[];
}

export interface GuardianState
  extends
    GuardianCoreState,
    GuardianDragonhunterState,
    GuardianFirebrandState,
    GuardianWillbenderState,
    GuardianLuminaryState {}

export interface GuardianRuntimeState {
  core: GuardianCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Dragonhunter'; state: GuardianDragonhunterState }
    | { kind: 'Firebrand'; state: GuardianFirebrandState }
    | { kind: 'Willbender'; state: GuardianWillbenderState }
    | { kind: 'Luminary'; state: GuardianLuminaryState };
}

export interface GuardianStrikeFields {
  readonly skillWeapon?: string;
  readonly isSymbol?: boolean;
  readonly triggeredBy?: string;
  readonly activationId?: string;
  readonly comboFields?: readonly { readonly ownerId: string; readonly fieldType: string; readonly duration: number }[];
  readonly metadata?: EffectMetadata;
  readonly priority?: number;
  readonly offTarget?: boolean;
  readonly weaponStrengthProfileId?: string;
  readonly willbenderFlames?: boolean;
  readonly at: number;
  readonly sourceId: SkillId;
  readonly skillId: SkillId | null;
  readonly skillName: string;
  readonly name: string;
  readonly coefficient: number;
  readonly source?: string;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly hits?: number;
  readonly hitIndex?: number;
  readonly totalHits?: number;
}

export type GuardianResolverContext = Gw2ResolverRuntime & {
  config: GuardianConfig;
  profession: GuardianRuntimeState;
};

export type GuardianVirtue = 'justice' | 'resolve' | 'courage';

/** Guardian-specific annotations on executed combat and weapon-bar facts. */
export type GuardianResolverEvent = Gw2ResolverEvent & {
  readonly applicationIndex?: number;
  readonly totalApplications?: number;
  readonly automatic?: boolean;
  readonly isSymbol?: boolean;
};

export interface GuardianSkill extends Skill {
  readonly pageCost?: number;
  readonly radiantForgeSkill?: boolean;
  readonly radiantWeapon?: string;
  readonly tome?: string;
}

export interface GuardianUiContext extends ProfessionUiCallbackContext<Partial<GuardianState>> {
  readonly config?: GuardianConfig;
  readonly state?: {
    readonly profession?: Partial<GuardianState>;
  };
}

/** UI slice whose callbacks read Guardian end-state projections. */
export type GuardianUiSlice = Partial<ProfessionUiContract<Partial<GuardianState>>>;
