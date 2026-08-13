import type { SchedulerRecord } from "../../../platform/engine/types.js";
import type {
  Gw2Build,
  Gw2CanonicalBuild,
  Gw2Config,
} from "../../../platform/gw2/types.js";
import type { ProfessionApplicationBuild } from "../../../app/profession/types.js";

export interface ElementalistConfig extends Gw2Config {
  readonly startAttunement?: string;
  readonly secondaryAttunement?: string;
  readonly catalystEnergy?: number;
  readonly evokerElement?: string | null;
  readonly evokerCharges?: number;
  readonly evokerEmpowered?: number;
  readonly pistolBullets?: Partial<Record<string, boolean>>;
}

export interface ElementalistBuildSpecialization {
  name: string;
  traits: string;
}

export interface ElementalistTrait extends SchedulerRecord {
  readonly tier: string;
  readonly name: string;
  readonly specialization: string;
  readonly position: number;
  readonly conditionDamage?: number;
  readonly ferocity?: number;
  readonly concentration?: number;
  readonly vitality?: number;
  readonly burningDuration?: number;
  readonly bleedingDuration?: number;
  readonly criticalChance?: number;
}

export interface ElementalistBuildInfusion {
  stat: string;
  count: number;
}

export interface ElementalistBuild extends Gw2Build {
  specializations?: ElementalistBuildSpecialization[];
  assumptions?: SchedulerRecord;
  sigils?: string[];
  startAttunement?: string;
  secondaryAttunement?: string;
  initialCatalystEnergy?: number;
  evokerElement?: string;
  initialEvokerCharges?: number;
  initialEvokerEmpowered?: number;
  selectedSkills?: readonly string[] | Record<string, string>;
}

export interface ElementalistCanonicalBuild extends Gw2CanonicalBuild {
  profession: "elementalist";
  assumptions: SchedulerRecord;
  startAttunement: string;
  secondaryAttunement: string;
  initialCatalystEnergy: number;
  evokerElement: string;
  initialEvokerCharges: number;
  initialEvokerEmpowered: number;
}

export interface ElementalistApplicationBuild extends ProfessionApplicationBuild {
  startAttunement: string;
  secondaryAttunement: string;
  initialCatalystEnergy: number;
  evokerElement: string;
  initialEvokerCharges: number;
  initialEvokerEmpowered: number;
}

export interface ElementalistBuildValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface ElementalistState extends SchedulerRecord {
  primaryAttunement: string;
  secondaryAttunement: string;
  catalystEnergy: number;
  evokerElement: string | null;
  evokerCharges: number;
  evokerEmpowered: number;
  pistolBullets: Record<string, boolean>;
}

export interface ElementalistConditionStateEntry {
  stacks: unknown[];
  tickActive: boolean;
  nextTick: number | null;
}

export interface ElementalistRunPhaseState {
  mode: "runtime" | "setup";
}

export interface ElementalistRelicState {
  buffUntil: number;
  aristocracyStacks: number;
  aristocracyUntil: number;
  aristocracyLastTrigger: number | null;
  blightbringerCount: number;
  blightbringerTrackedCasts: Set<unknown>;
  thiefStacks: number;
  thiefUntil: number;
  nourysStacks: number;
  nourysActiveUntil: number;
  bloodstoneStacks: number;
  bloodstoneStacksUntil: number;
  bloodstoneExplosionUntil: number;
  thornsStacks: number;
  thornsReadyAt: number;
}

export interface ElementalistProcState extends SchedulerRecord {
  bountifulPowerStacks: number;
  sigilCritAccum: number;
  sigilDoomPending: boolean;
  traitBurnPrecAccum: number;
  traitRagingStormAccum: number;
  traitArcanePrecAccum: number;
  traitRenewingStaminaAccum: number;
  freshAirAccum: number;
  freshAirResetAt: number;
  electricEnchantmentStacks: number;
  dazingDischargeUntil: number;
  shatteringStoneHits: number;
  shatteringStoneUntil: number;
  familiarCastSeq: number;
  familiarCanceledCastIds: Record<string, boolean>;
  familiarCanceledLoggedCastIds: Record<string, boolean>;
  lastEmpoweredFamiliarByBasic: Record<string, unknown>;
  foodCritProcAccum: number;
}

export interface ElementalistPerSkillRecord {
  strike: number;
  condition: number;
  casts: number;
  castTimeMs: number;
  hits: number;
}

export interface ElementalistCombatConditionStack extends SchedulerRecord {
  cond: string;
}

export interface ElementalistRuntimeWindowState {
  arcaneEchoUntil: number;
  signetFirePassiveLostWindows: Array<{
    from: number;
    until: number;
  }>;
}

export interface ElementalistTimingWindowState extends SchedulerRecord {
  castUntil: number;
  runtimeWindowState: ElementalistRuntimeWindowState;
  schedulerTimingWindowState?: ElementalistTimingWindowState;
}

export interface ElementalistCatalystState {
  energy: number | null;
  sphereActiveUntil: number;
  sphereWindows: Array<{ start: number; end: number }>;
  sphereExpiry: Record<string, number>;
}

export interface ElementalistEvokerState {
  element: string | null;
  charges: number;
  empowered: number;
  igniteStep: number;
  igniteLastUse: number;
  elemBalanceCount: number;
  elemBalanceActive: boolean;
  elemBalanceExpiry: number;
  elemBalanceActivatedAt: number;
}

export interface ElementalistCastWindowSkill extends SchedulerRecord {
  readonly castTime?: number;
  readonly type?: string;
}

export interface ElementalistConcurrentStep extends SchedulerRecord {
  readonly name: string;
  readonly offset?: number;
  readonly _ri?: number;
  readonly interruptMs?: number;
}

export interface ElementalistCastWindowContext {
  readonly S: ElementalistLegacyRuntimeState & {
    t: number;
    _ri?: number;
  };
  adjustCastTime(
    castMs: number,
    startTime: number,
    options: { readonly ignoreQuickness: boolean },
  ): { readonly castMs: number; readonly scaleOff: number };
  setTime(time: number): void;
  runStep(
    name: string,
    concurrent: boolean,
    nested: readonly unknown[],
    options: { readonly interruptMs?: number },
  ): unknown;
}

export interface ElementalistLegacyRuntimeState extends SchedulerRecord {
  runPhase?: ElementalistRunPhaseState;
  hasExplicitCombatStart?: boolean;
  combatStartTime?: number | null;
  schedulerConditionState?: ElementalistLegacyRuntimeState;
  condState?: Record<string, ElementalistConditionStateEntry>;
  traitICD?: Record<string, number>;
  relicICD?: Record<string, number>;
  sigilICD?: Record<string, number>;
  relicState?: ElementalistRelicState;
  relicBuffUntil?: number;
  relicAristocracyStacks?: number;
  relicAristocracyUntil?: number;
  relicAristocracyLastTrigger?: number | null;
  relicBlightbringerCount?: number;
  relicBlightbringerTrackedCasts?: Set<unknown>;
  relicThiefStacks?: number;
  relicThiefUntil?: number;
  relicNourysStacks?: number;
  relicNourysActiveUntil?: number;
  relicBloodstoneStacks?: number;
  relicBloodstoneStacksUntil?: number;
  relicBloodstoneExplosionUntil?: number;
  relicThornsStacks?: number;
  relicThornsReadyAt?: number;
  procState?: ElementalistProcState;
  schedulerReportingState?: ElementalistLegacyRuntimeState;
  log?: unknown[];
  steps?: unknown[];
  perSkill?: Record<string, ElementalistPerSkillRecord>;
  schedulerCombatState?: ElementalistLegacyRuntimeState;
  fields?: SchedulerRecord[];
  auras?: SchedulerRecord[];
  allCondStacks?: ElementalistCombatConditionStack[];
  _condMap?: Map<string, ElementalistCombatConditionStack[]>;
  schedulerTimingWindowState?: ElementalistTimingWindowState;
  castUntil?: number;
  runtimeWindowState?: ElementalistRuntimeWindowState;
  catalystState?: ElementalistCatalystState;
  evokerState?: ElementalistEvokerState;
  energy?: number | null;
  sphereActiveUntil?: number;
  sphereWindows?: Array<{ start: number; end: number }>;
  sphereExpiry?: Record<string, number>;
  evokerElement?: string | null;
  evokerCharges?: number;
  evokerEmpowered?: number;
  igniteStep?: number;
  igniteLastUse?: number;
  elemBalanceCount?: number;
  elemBalanceActive?: boolean;
  elemBalanceExpiry?: number;
  elemBalanceActivatedAt?: number;
}
