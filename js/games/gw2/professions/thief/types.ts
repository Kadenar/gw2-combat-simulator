import type {
  Gw2Build,
  Gw2BuildSpecialization,
  Gw2CanonicalBuild,
  ProfessionBuildAssumptions
} from '#gw2/platform/builds/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ProfessionUiCallbackContext } from '#gw2/platform/profession-presentation/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { BalanceProfile, CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';

import type { Gw2WeaponMatcherContext } from '#gw2/platform/equipment/weapons/types.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import type { AntiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import type { DaredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';
import type { DeadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import type { SpecterState } from '#gw2/professions/thief/specializations/specter/state.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
export type ThiefDodge = 'Dodge' | 'Lotus Training' | 'Bounding Dodger' | 'Unhindered Combatant';

export interface ThiefBuild extends Gw2Build {
  specializations?: Gw2BuildSpecialization[];
  selectedSkillIds?: Record<string, SkillId | null>;
  selectedDodge?: ThiefDodge;
}

export interface ThiefCanonicalBuild extends Gw2CanonicalBuild {
  selectedDodge: ThiefDodge;
  initialInitiative: number;
  initialSpinningAxes: number;
  initialShadowForce: number;
}

type ThiefDeterministicChoices = {
  readonly forgedSurferBombsHit?: number;
};

export interface ThiefConfig extends Gw2Config {
  readonly assumptions?: ProfessionBuildAssumptions;
  readonly professionAssumptions?: ProfessionBuildAssumptions;
  readonly selectedDodge?: ThiefDodge;
  readonly initialInitiative?: number;
  readonly initialSpinningAxes?: number;
  readonly initialShadowForce?: number;
  readonly deterministicChoices?: ThiefDeterministicChoices;
}

export type ThiefArtifactKind = 'offensive' | 'defensive';
export type ThiefDoubleEdgeOutcome = 'success' | 'backfire';

export type ThiefState = ThiefCoreState & DaredevilState & DeadeyeState & SpecterState & AntiquaryState;

export interface ThiefRuntimeState {
  core: ThiefCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Daredevil'; state: DaredevilState }
    | { kind: 'Deadeye'; state: DeadeyeState }
    | { kind: 'Specter'; state: SpecterState }
    | { kind: 'Antiquary'; state: AntiquaryState };
}

export interface ThiefSummonCondition {
  readonly condition: string;
  readonly duration: number;
  readonly stacks: number;
}

export interface ThiefSummonStrike {
  readonly name: string;
  readonly coefficientPerHit: number;
  readonly hits?: number;
  readonly initialDelay: number;
  readonly interval?: number;
  readonly skillId?: SkillId;
  readonly conditions?: readonly ThiefSummonCondition[];
}

export interface ThiefSummonDefinition {
  readonly name: string;
  readonly displayName?: string;
  readonly variant?: string;
  readonly weapon: string;
  readonly weaponStrengthProfileId: string;
  readonly attacks?: readonly ThiefSummonStrike[];
}

/** Elite summon tuning is owned by a selected catalog profile, separate from the shared guild skill. */
export interface ThiefGuildSummonProfile extends BalanceProfile, ThiefSummonDefinition {}

interface ThiefSummonAttack {
  readonly basePower: number;
  readonly criticalChance: number;
  readonly criticalDamage: number;
  readonly duration: number;
  readonly summons: readonly ThiefSummonDefinition[];
}

export interface ThiefSkill extends Skill {
  readonly artifactKind?: ThiefArtifactKind;
  readonly backfire?: boolean;
  readonly dualWieldOpener?: boolean;
  readonly initiativeCost?: number;
  readonly kneelSkill?: boolean;
  readonly malicious?: boolean;
  readonly movementSkill?: boolean;
  readonly preservesStealth?: boolean;
  readonly shadowShroudSkill?: boolean;
  /** Marks the two Shadow Shroud bar transitions so replay and live owners can order and select them. */
  readonly shadowShroudTransition?: 'enter' | 'exit';
  readonly spearStealthAttack?: boolean;
  readonly stealthAttack?: boolean;
  readonly stealTraitSkill?: boolean;
  readonly stealRechargeMode?: 'multiplicative' | 'additive';
  readonly summonAttack?: ThiefSummonAttack;
}

export type ThiefSimulationEvent = SimulationEvent & {
  readonly application?: ThiefSimulationEvent;
  readonly cancelled?: boolean;
  readonly coefficient?: number;
  readonly condition?: string;
  readonly deadeyeMaliceSnapshot?: number;
};

export type ThiefResolverEvent = Gw2ResolverEvent & {
  readonly application?: ThiefResolverEvent;
  readonly deadeyeMaliceSnapshot?: number;
};

export type ThiefResolverContext = MechanicCombatContext & {
  config: ThiefConfig;
  profession: ThiefRuntimeState;
  readonly state?: { readonly profession: ThiefRuntimeState };
};

export interface ThiefUiContext extends Omit<ProfessionUiCallbackContext<Partial<ThiefState>>, 'build'> {
  readonly config?: ThiefConfig;
  readonly build?: ThiefBuild | null;
  readonly initialInitiative?: number;
  readonly initialShadowForce?: number;
}

export interface ThiefWeaponMatcherContext extends Gw2WeaponMatcherContext {
  readonly catalog?: CanonicalCatalog<ThiefSkill> | null;
  readonly config?: ThiefConfig;
  readonly state?: {
    readonly profession?: ThiefRuntimeState | Partial<ThiefState>;
  };
}
