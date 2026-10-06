import type { EffectEmissionService } from '#gw2/platform/effects/emission.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import type { RefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import type { Gw2TargetConfig } from '#gw2/platform/combat/state/targets.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { Gw2ResolverHelpers } from '#gw2/platform/resolver/types.js';

/** Minimal configuration surface consumed by relic rules. */
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
  timelineLength?: number;
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
  readonly combatStartTime?: number | null;
  readonly relic?: Gw2RelicRuntime;
}

interface Gw2RelicEmissionContext {
  readonly combatStartTime?: number | null;
  readonly hasExplicitCombatStart?: boolean;
  readonly effects: EffectEmissionService;
}

export interface Gw2RelicContext {
  readonly buffs?: ReadonlyMap<string, readonly Gw2TimedBuffApplication[]>;
  readonly combatStartPending?: boolean;
  readonly helpers?: Gw2ResolverHelpers;
  precastRelics?: readonly Gw2RelicRuntime[];
  readonly config: Gw2RelicConfig;
  /** Relics may query target thresholds; only shared damage resolution can update totals. */
  readonly totals: { readonly strike: number; readonly condition: number };
  readonly effects: EffectEmissionService;
  readonly combatStartTime?: number | null;
  readonly relic?: Gw2RelicRuntime;
}

export interface Gw2ConditionHelpers {
  activeConditionStackCount(context: Gw2RelicContext, condition: string, at: number): number;
}

export interface Gw2RelicRule {
  readonly buffPolicies?: readonly BuffStatePolicy[];
  /** The same per-occurrence payload is called after combat eligibility or directly by the damage calculator. */
  readonly damagePayload?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
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
  readonly activate?: (context: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent) => unknown;
  readonly passiveTimeline?: (context: Gw2RelicContext, state: Gw2RelicState, end: number) => unknown;
  readonly boon?: (context: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent) => unknown;
  readonly combo?: (context: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent) => unknown;
  readonly strikeMultiplier?: (context: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent) => number;
  readonly outgoingDamageBonus?: (
    context: Gw2RelicRuntimeContext,
    state: Gw2RelicState,
    damageType: 'strike' | 'condition',
    at: number,
    event: SimulationEvent | null
  ) => number;
  readonly criticalChanceBonus?: (
    context: Gw2RelicRuntimeContext,
    state: Gw2RelicState,
    event: SimulationEvent,
    mightStacks: number
  ) => number;
  readonly afterHit?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    event: SimulationEvent,
    skill: Skill | null | undefined
  ) => unknown;
  readonly conditionDurationBonus?: (context: Gw2RelicContext, state: Gw2RelicState, at: number) => number;
  readonly conditionDamageBonus?: (context: Gw2RelicContext, state: Gw2RelicState, at: number) => number;
  readonly condition?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    application: SimulationEvent,
    helpers: Gw2ConditionHelpers
  ) => unknown;
  readonly damageResolved?: (context: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent) => unknown;
}

export interface Gw2RelicRuntime {
  readonly id: number | null;
  readonly rules: Readonly<Gw2RelicRule>;
  readonly state: Gw2RelicState;
}
