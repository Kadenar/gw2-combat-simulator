import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

import type { Gw2Build, Gw2BuildSpecialization, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import type { HarbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import type { ReaperState } from '#gw2/professions/necromancer/specializations/reaper/state.js';
import type { RitualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import type { ScourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
export interface NecromancerBuild extends Gw2Build {
  specializations?: Gw2BuildSpecialization[];
  selectedSkills?: Record<string, string>;
}

export interface NecromancerCanonicalBuild extends Gw2CanonicalBuild {
  initialResource: number;
  initialBlight: number;
  initialCascadingCorruptionStacks: number;
}

export interface NecromancerConfig extends Gw2Config {
  readonly initialBlight?: number;
  readonly initialCascadingCorruptionStacks?: number;
  readonly duration?: number;
  readonly professionAssumptions?: Readonly<Record<string, unknown>>;
}

export interface NecromancerState
  extends NecromancerCoreState, ReaperState, ScourgeState, HarbingerState, RitualistState {}

export interface NecromancerRuntimeState {
  core: NecromancerCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Reaper'; state: ReaperState }
    | { kind: 'Scourge'; state: ScourgeState }
    | { kind: 'Harbinger'; state: HarbingerState }
    | { kind: 'Ritualist'; state: RitualistState };
}

/** Actual mechanics share one owned family state and one live clock. */
export type NecromancerRuntime = Gw2Runtime<NecromancerRuntimeState>;

export interface NecromancerSkill extends Skill {
  readonly blightCost?: number;
  readonly dhuumfireDuration?: number;
  readonly flipParent?: string;
  readonly lifeForceCost?: number;
  readonly lifeForceGain?: number;
  readonly shroud?: string;
  readonly shroudEntry?: string;
  readonly shroudExit?: string;
  readonly shroudProfileId?: string;
  readonly minimumShroudLifeForcePercent?: number;
  readonly usableInShroud?: boolean;
  readonly shroudSlot?: number;
  readonly slotSelectable?: boolean;
}

export type NecromancerResolverEvent = Gw2ResolverEvent & {
  readonly application?: NecromancerResolverEvent;
  readonly summonCount?: number;
  readonly summonOwner?: string;
  readonly summonOwnerBase?: string;
  readonly summonCriticalChance?: number;
  readonly summonCriticalDamage?: number;
  readonly mode?: string;
  readonly playerStacks?: number;
  readonly allyStacks?: number;
  readonly spell?: string;
  readonly procIndex?: number;
  readonly alliesReceiveFullBenefit?: boolean;
  readonly controlKind?: string;
  readonly effectiveDuration?: number;
};

export type NecromancerResolverContext = Gw2ResolverRuntime & {
  config: NecromancerConfig;
  profession: NecromancerRuntimeState;
};

export interface NecromancerUiContext extends Omit<ProfessionUiCallbackContext<Partial<NecromancerState>>, 'build'> {
  readonly config?: NecromancerConfig;
  readonly build?: NecromancerBuild | null;
  readonly state?: {
    readonly profession?: Partial<NecromancerState>;
  };
}

/** UI slice whose callbacks read Necromancer end-state projections. */
export type NecromancerUiSlice = Partial<ProfessionUiContract<Partial<NecromancerState>>>;
