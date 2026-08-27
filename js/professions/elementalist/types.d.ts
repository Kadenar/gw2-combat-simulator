import type {
  CanonicalCatalog,
  CastContext,
  CastLifecycleContext,
  SchedulerContext,
  SchedulerRecord,
  SchedulerState,
  SimulationEvent,
  Skill,
  SkillId
} from '../../platform/engine/types.js';
import type { Gw2Build, Gw2CanonicalBuild } from '../../platform/gw2/builds/types.js';
import type { Gw2Config } from '../../platform/gw2/simulation/config.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '../../platform/gw2/resolver/types.js';
import type { ProfessionApplicationBuild } from '../../app/profession/types.js';
import type { ElementalistCoreState } from './core/state.js';
import type { TempestState } from './specializations/tempest/state.js';
import type { WeaverState } from './specializations/weaver/state.js';
import type { CatalystState } from './specializations/catalyst/state.js';
import type { EvokerState } from './specializations/evoker/state.js';

export interface ElementalistBuildSpecialization {
  name: string;
  traits: string;
}

export interface CatalystEmpowermentPool {
  readonly power: number;
  readonly precision: number;
  readonly ferocity: number;
  readonly conditionDamage: number;
  readonly expertise: number;
  readonly concentration: number;
}

export interface ElementalistBuild extends Gw2Build {
  specializations?: ElementalistBuildSpecialization[];
  assumptions?: SchedulerRecord;
  startAttunement?: string;
  secondaryAttunement?: string;
  initialCatalystEnergy?: number;
  evokerElement?: string;
  initialEvokerCharges?: number;
  initialEvokerEmpowered?: number;
  pistolBullets?: Partial<Record<'Fire' | 'Water' | 'Air' | 'Earth', boolean>>;
  selectedSkills?: readonly string[] | Record<string, string>;
}

export interface ElementalistCanonicalBuild extends Gw2CanonicalBuild {
  profession: 'elementalist';
  assumptions: SchedulerRecord;
  startAttunement: string;
  secondaryAttunement: string;
  initialCatalystEnergy: number;
  evokerElement: string;
  initialEvokerCharges: number;
  initialEvokerEmpowered: number;
  pistolBullets: Record<'Fire' | 'Water' | 'Air' | 'Earth', boolean>;
}

export interface ElementalistConfig extends Gw2Config {
  readonly specialization?: string;
  readonly startAttunement?: string;
  readonly secondaryAttunement?: string;
  readonly initialCatalystEnergy?: number;
  readonly evokerElement?: string;
  readonly initialEvokerCharges?: number;
  readonly initialEvokerEmpowered?: number;
  readonly pistolBullets?: Readonly<Partial<Record<'Fire' | 'Water' | 'Air' | 'Earth', boolean>>>;
}

export interface ElementalistRuntimeState {
  core: ElementalistCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Tempest'; state: TempestState }
    | { kind: 'Weaver'; state: WeaverState }
    | { kind: 'Catalyst'; state: CatalystState }
    | { kind: 'Evoker'; state: EvokerState };
}

export interface ElementalistState extends ElementalistCoreState, WeaverState, CatalystState, EvokerState {}

export interface ElementalistSkill extends Skill {
  readonly attunement?: string;
  readonly aura?: string;
  readonly chainRoot?: SkillId;
  readonly overload?: boolean;
  readonly skillFamily?: string;
  readonly skillWeapon?: string;
}

export type ElementalistSchedulerContext = SchedulerContext<ElementalistRuntimeState> &
  SchedulerRecord & {
    readonly catalog: CanonicalCatalog<ElementalistSkill>;
    readonly config: ElementalistConfig;
  };

export type ElementalistPrecastContext = CastContext<ElementalistRuntimeState> & {
  readonly catalog: CanonicalCatalog<ElementalistSkill>;
  readonly config: ElementalistConfig;
  readonly skill: ElementalistSkill;
};

export type ElementalistCastContext = CastLifecycleContext<ElementalistRuntimeState> & {
  readonly catalog: CanonicalCatalog<ElementalistSkill>;
  readonly config: ElementalistConfig;
  readonly skill: ElementalistSkill;
};

export type ElementalistSimulationEvent = SimulationEvent & {
  readonly application?: ElementalistSimulationEvent;
  readonly aura?: string;
  readonly coefficient?: number;
  readonly condition?: string;
  readonly elementalistAttunement?: string;
  readonly fieldType?: string;
  readonly sourceSkill?: string;
};

export type ElementalistResolverEvent = Gw2ResolverEvent & {
  readonly application?: Gw2ResolverEvent;
  readonly aura?: string;
  readonly coefficient?: number;
  readonly condition?: string;
  readonly elementalistAttunement?: string;
  readonly fieldType?: string;
  readonly sourceSkill?: string;
};

export type ElementalistResolverContext = Gw2ResolverRuntime & {
  config: ElementalistConfig;
  profession: ElementalistRuntimeState;
  readonly state?: { readonly profession: ElementalistRuntimeState };
};

export interface ElementalistEndStateProjectionOptions {
  readonly schedulerState: SchedulerState<ElementalistRuntimeState>;
}

export interface ElementalistApplicationBuild extends ProfessionApplicationBuild {
  startAttunement: string;
  secondaryAttunement: string;
  initialCatalystEnergy: number;
  evokerElement: string;
  initialEvokerCharges: number;
  initialEvokerEmpowered: number;
  pistolBullets: Record<'Fire' | 'Water' | 'Air' | 'Earth', boolean>;
}
