/** Relic rules receive typed observations while the runtime privately owns their state. */
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import type { CombatEngagementQueries } from '#gw2/platform/combat/engagement.js';
import type { RefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import type { Gw2TargetConfig } from '#gw2/platform/combat/state/targets.js';
import type { EffectEmissionService } from '#gw2/platform/effects/emission.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { Gw2ResolverHelpers } from '#gw2/platform/resolver/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Configuration fields consumed by relic rules. */
interface Gw2RelicConfig {
  readonly relic?: string;
  readonly precastRelics?: readonly string[];
  readonly initialThornsStacks?: number;
  readonly target?: Gw2TargetConfig;
}

/** Optional fields are initialized by the relic rule that owns each timer or history. */
export interface Gw2RelicState {
  refreshedStacks?: RefreshedStacks;
  combatStartTime?: number;
  timelineEvents?: readonly SimulationEvent[];
  trackedActivations?: Set<string>;
  count?: number;
  combatMarker?: SimulationEvent;
  windows?: { from: number; until: number }[];
  whirlReadyAt?: number;
  activations?: {
    readonly at: number;
    readonly expiresAt: number;
    readonly stacks: number;
  }[];
  readyAt?: number;
  stackReadyAt?: number;
  stacks?: number;
  expiresAt?: number;
}

export interface Gw2RelicRuntimeContext {
  readonly engagement?: Pick<CombatEngagementQueries, 'startTime'>;
  readonly relic?: Gw2RelicQueryOwner;
}

interface Gw2RelicEmissionContext {
  readonly engagement: CombatEngagementQueries;
  readonly effects: EffectEmissionService;
}

export interface Gw2RelicContext {
  readonly buffs?: ReadonlyMap<string, readonly Gw2TimedBuffApplication[]>;
  readonly engagement: CombatEngagementQueries;
  readonly helpers: Gw2ResolverHelpers;
  readonly config: Gw2RelicConfig;
  /** Relics may query target thresholds; only shared damage resolution can update totals. */
  readonly totals: { readonly strike: number; readonly condition: number };
  readonly effects: EffectEmissionService;
  readonly relic?: Gw2RelicQueryOwner;
}

export interface Gw2ConditionHelpers {
  activeConditionStackCount(context: Gw2RelicContext, condition: string, at: number): number;
}

/** Pure relic queries expose only their required observations, never emission capabilities. */
export type Gw2RelicStrikeQueryContext = Readonly<
  Pick<Gw2RelicContext, 'config' | 'totals' | 'buffs' | 'helpers' | 'relic'>
>;

export type Gw2RelicDurationQueryContext = Pick<Gw2RelicContext, 'buffs' | 'relic'>;

export type Gw2RelicAttributeQueryContext = Pick<Gw2RelicContext, 'config' | 'relic'>;

export interface Gw2RelicRule {
  readonly buffPolicies?: readonly BuffStatePolicy[];
  /** The same per-occurrence payload is called after combat eligibility or directly by the damage calculator. */
  readonly damagePayload?: (
    context: Gw2RelicContext,
    event: SimulationEvent,
    inputs?: import('#gw2/platform/skill-damage/types.js').DamageInputs
  ) => void;
  readonly createState?: () => Gw2RelicState;
  readonly emitConditionEffects?: (
    context: Gw2RelicEmissionContext,
    state: Gw2RelicState,
    event: SimulationEvent
  ) => unknown;
  /** Observes committed activations with their catalog skill so skill classifications can trigger relic facts. */
  readonly emitActionEffects?: (
    context: Gw2RelicEmissionContext,
    state: Gw2RelicState,
    event: SimulationEvent,
    skill: Skill | undefined
  ) => unknown;
  readonly control?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    event: SimulationEvent,
    helpers: Gw2ConditionHelpers
  ) => unknown;
  /** Live actions and completions trigger equipment at their actual semantic boundary. */
  readonly action?: (context: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent) => unknown;
  readonly completed?: (context: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent) => unknown;
  readonly activate?: (context: Gw2RelicContext, event: SimulationEvent) => unknown;
  readonly passiveTimeline?: (context: Gw2RelicContext, state: Gw2RelicState, end: number) => unknown;
  readonly boon?: (context: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent) => unknown;
  readonly combo?: (context: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent) => unknown;
  readonly strikeMultiplier?: (
    context: Gw2RelicStrikeQueryContext,
    state: Gw2RelicState,
    event: SimulationEvent
  ) => number;
  readonly outgoingDamageBonus?: (context: Gw2RelicRuntimeContext, state: Gw2RelicState, at: number) => number;
  readonly criticalChanceBonus?: (event: SimulationEvent, mightStacks: number) => number;
  readonly afterHit?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    event: SimulationEvent,
    skill: Skill | null | undefined
  ) => unknown;
  /** Preparation packets may grant relic buffs without resolving damage or dispatching ordinary hit reactions. */
  readonly precombatStrike?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    event: SimulationEvent,
    skill: Skill | null | undefined
  ) => unknown;
  readonly conditionDurationBonus?: (context: Gw2RelicDurationQueryContext, state: Gw2RelicState, at: number) => number;
  readonly conditionDamageBonus?: (context: Gw2RelicAttributeQueryContext, at: number) => number;
  /** Earned concentration scales subsequent boon grants, including grants made by companions. */
  readonly concentrationBonus?: (state: Gw2RelicState, at: number) => number;
  readonly condition?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    application: SimulationEvent,
    helpers: Gw2ConditionHelpers & { readonly stacksBeforeApplication: number }
  ) => unknown;
  readonly damageResolved?: (context: Gw2RelicContext, event: SimulationEvent) => unknown;
}

/** Query owners expose no mutable instances or gameplay operations. */
export interface Gw2RelicQueryOwner {
  readonly id: number | null;
  readonly queries: Gw2RelicQueries;
}

export interface Gw2RelicQueries {
  strikeMultiplier(context: Gw2RelicStrikeQueryContext, event: SimulationEvent): number;
  outgoingDamageBonus(context: Gw2RelicRuntimeContext, at: number): number;
  criticalChanceBonus(event: SimulationEvent, mightStacks: number): number;
  conditionDurationBonus(context: Gw2RelicDurationQueryContext, at: number): number;
  conditionDamageBonus(context: Gw2RelicAttributeQueryContext, at: number): number;
  concentrationBonus(at: number): number;
}

/**
 * Dispatches events to the relevant relic rules with their private state. Callers determine execution order.
 * Unused equipped-relic hooks are absent so optional calls skip calculating per-hit or per-application arguments.
 */
export interface Gw2RelicRuntime extends Gw2RelicQueryOwner {
  readonly buffPolicies: readonly BuffStatePolicy[];
  setCombatMarker(event: SimulationEvent): void;
  completed(context: Gw2RelicContext, event: SimulationEvent): void;
  readonly action?: (context: Gw2RelicContext, event: SimulationEvent, skill: Skill | undefined) => void;
  emitConditionEffects(context: Gw2RelicContext, event: SimulationEvent): void;
  activate(context: Gw2RelicContext, event: SimulationEvent): void;
  passiveTimeline(context: Gw2RelicContext, end: number): void;
  boon(context: Gw2RelicContext, event: SimulationEvent): void;
  combo(context: Gw2RelicContext, event: SimulationEvent): void;
  damageResolved(context: Gw2RelicContext, event: SimulationEvent): void;
  readonly afterHit?: (context: Gw2RelicContext, event: SimulationEvent, skill: Skill | null | undefined) => void;
  readonly precombatStrike?: (
    context: Gw2RelicContext,
    event: SimulationEvent,
    skill: Skill | null | undefined
  ) => void;
  readonly control?: (context: Gw2RelicContext, event: SimulationEvent, helpers: Gw2ConditionHelpers) => void;
  readonly condition?: (
    context: Gw2RelicContext,
    event: SimulationEvent,
    helpers: Gw2ConditionHelpers & { readonly stacksBeforeApplication: number }
  ) => void;
  /** Isolated measurement executes an owned payload without enabling ordinary equipment triggers. */
  damagePayload(
    context: Gw2RelicContext,
    event: SimulationEvent,
    inputs?: import('#gw2/platform/skill-damage/types.js').DamageInputs
  ): boolean;
}
