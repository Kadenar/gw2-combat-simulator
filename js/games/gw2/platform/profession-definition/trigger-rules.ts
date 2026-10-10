import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent, Gw2ResolverStage } from '#gw2/platform/resolver/types.js';
import type { ProfessionRuntimeOptions } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import { type ProfileAmount } from '#gw2/platform/effects/actions.js';
import { isTriggerPoint, type TriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  emitTraitProfile,
  invokeTraitSkill,
  type TraitAttribution
} from '#gw2/platform/profession-definition/trait-emission.js';

export interface RechargeRule<T extends object, TSkill extends Skill = Skill> {
  readonly trait?: SkillId;
  readonly when: (runtime: MechanicQueryContext<T, TSkill>, skill: TSkill) => boolean;
  readonly multiplier: ProfileAmount;
  readonly order?: number;
}

type TriggerAttributionSource<T extends object, Trigger, TSkill extends Skill = Skill> =
  TraitAttribution | ((runtime: MechanicQueryContext<T, TSkill>, trigger: Trigger) => TraitAttribution);

/** Each trigger does exactly one thing: emit a trait profile, invoke a triggered skill, or run an imperative reaction. */
type TriggerReaction<TRun, TAttribution> =
  | {
      readonly emit: SkillId;
      readonly effects?: (effect: SkillEffect) => boolean;
      readonly attribution?: TAttribution;
      readonly invoke?: undefined;
      readonly announce?: undefined;
      readonly run?: undefined;
    }
  | {
      readonly invoke: SkillId;
      /** Report the trait proc beside the invoked skill's packets. */
      readonly announce?: boolean;
      readonly emit?: undefined;
      readonly effects?: undefined;
      readonly attribution?: undefined;
      readonly run?: undefined;
    }
  | {
      readonly run: TRun;
      readonly emit?: undefined;
      readonly effects?: undefined;
      readonly attribution?: undefined;
      readonly invoke?: undefined;
      readonly announce?: undefined;
    };

type TraitTriggerBase = {
  readonly trait: SkillId;
  /** `profile` claims the emitted or owning profile's internal cooldown; `skill` shares the invoked skill's recharge. */
  readonly cooldown?: 'profile' | 'skill';
  /** Module-scoped ordering for platform stages; a trigger point's order list is authoritative instead. */
  readonly order?: number;
  /** Intrinsic specialization behavior runs without selection, like modifier rules that opt out. */
  readonly requiresSelection?: boolean;
};

const pointListener = Symbol('typed trait point listener');
type UnownedPoint<T> = T extends { readonly trait: SkillId; readonly on: TriggerPoint } ? Omit<T, 'trait'> : never;

/** The point owns the input type; declarative delivery is available only when that input carries its cause. */
type PointReaction<TInput extends object, TSkill extends Skill> = Omit<TraitTriggerBase, 'trait' | 'order'> & {
  readonly when?: (runtime: MechanicQueryContext<never, TSkill>, input: TInput) => boolean;
} & (TInput extends { readonly cause: Gw2ResolverEvent }
    ? TriggerReaction<
        (runtime: MechanicContext<never, TSkill>, input: TInput) => void,
        TriggerAttributionSource<never, TInput, TSkill>
      >
    : { readonly run: (runtime: MechanicContext<never, TSkill>, input: TInput) => void });

/** Bind listeners before erasing heterogeneous point inputs for storage; raw point registrations are unsupported. */
export function onTriggerPoint<TInput extends object, TSkill extends Skill = Skill>(
  point: TriggerPoint<TInput>,
  reaction: PointReaction<NoInfer<TInput>, TSkill>
): UnownedPoint<TraitTrigger<never, TSkill>> {
  const listener = { ...reaction, on: point, [pointListener]: true as const };
  assertTraitTrigger(listener, `Trigger point ${point.id}`);
  // The callback was checked against this point above; only storage erases its input to the heterogeneous union.
  return Object.freeze(listener) as UnownedPoint<TraitTrigger<never, TSkill>>;
}

export type TraitTrigger<T extends object, TSkill extends Skill = Skill> = TraitTriggerBase &
  (
    | ({
        readonly on: 'castStart';
        readonly when?: (runtime: MechanicQueryContext<T, TSkill>, cast: RuntimeCast<TSkill>) => boolean;
      } & TriggerReaction<
        (runtime: MechanicContext<T, TSkill>, cast: RuntimeCast<TSkill>) => void,
        TriggerAttributionSource<T, RuntimeCast<TSkill>, TSkill>
      >)
    | ({
        readonly on: 'castCommit';
        readonly when?: (runtime: MechanicQueryContext<T, TSkill>, cast: RuntimeCast<TSkill>) => boolean;
      } & TriggerReaction<
        (runtime: MechanicContext<T, TSkill>, cast: RuntimeCast<TSkill>) => void,
        TriggerAttributionSource<T, RuntimeCast<TSkill>, TSkill>
      >)
    | ({
        readonly on: 'damage.resolved';
        readonly when?: (
          runtime: MechanicQueryContext<T, TSkill>,
          event: Gw2ResolverEvent,
          details: NativeResolvedDamageDetails
        ) => boolean;
      } & TriggerReaction<
        (runtime: MechanicContext<T, TSkill>, event: Gw2ResolverEvent, details: NativeResolvedDamageDetails) => void,
        TriggerAttributionSource<T, Gw2ResolverEvent, TSkill>
      >)
    | ({
        readonly on: Exclude<Gw2ResolverStage, 'damage.resolved'>;
        readonly when?: (runtime: MechanicQueryContext<T, TSkill>, event: Gw2ResolverEvent) => boolean;
      } & TriggerReaction<
        (runtime: MechanicContext<T, TSkill>, event: Gw2ResolverEvent) => void,
        TriggerAttributionSource<T, Gw2ResolverEvent, TSkill>
      >)
    | ({
        // onTriggerPoint checked the concrete input before this heterogeneous storage boundary.
        readonly on: TriggerPoint;
        readonly [pointListener]: true;
        readonly when?: (runtime: MechanicQueryContext<T, TSkill>, input: never) => boolean;
      } & TriggerReaction<
        (runtime: MechanicContext<T, TSkill>, input: never) => void,
        TriggerAttributionSource<T, never, TSkill>
      >)
  );

/** A compiled point listener; selection, eligibility, and cooldown admission are already folded in. */
export type TriggerListener<T extends object, TSkill extends Skill = Skill> = (
  runtime: MechanicContext<T, TSkill>,
  input: object
) => void;

// The compiled triggers below read their callbacks through one loose view of the discriminated declaration.
type LooseTrigger = TraitTriggerBase & {
  readonly on: string | TriggerPoint;
  readonly when?: (...args: never[]) => boolean;
  readonly attribution?: TraitAttribution | ((...args: never[]) => TraitAttribution);
  readonly emit?: SkillId;
  readonly effects?: (effect: SkillEffect) => boolean;
  readonly invoke?: SkillId;
  readonly announce?: boolean;
  readonly run?: (...args: never[]) => void;
};

const CAST_STAGES = new Set(['castStart', 'castCommit']);
const RESOLVER_STAGES = new Set<string>([
  'aura.applied',
  'combo.resolved',
  'buff.applied',
  'damage.resolving',
  'damage.resolved',
  'condition.applied',
  'condition-tick.resolved',
  'control.resolved'
] satisfies Gw2ResolverStage[]);

/** Reject authoring mistakes when a trait or module is declared, before a silent no-op can reach a simulation. */
export function assertTraitTrigger(rule: unknown, owner: string): void {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule))
    throw new TypeError(`${owner} trigger must be an object.`);
  const trigger = rule as LooseTrigger;
  for (const key of Object.keys(rule))
    if (
      ![
        'trait',
        'on',
        'when',
        'emit',
        'effects',
        'attribution',
        'invoke',
        'announce',
        'run',
        'cooldown',
        'order',
        'requiresSelection'
      ].includes(key)
    )
      throw new TypeError(`${owner} trigger has an unsupported field ${key}.`);
  const point = isTriggerPoint(trigger.on);
  if (point && !(rule as { readonly [pointListener]?: boolean })[pointListener])
    throw new TypeError(`${owner} point listeners must use onTriggerPoint.`);
  if (!point && !(typeof trigger.on === 'string' && (CAST_STAGES.has(trigger.on) || RESOLVER_STAGES.has(trigger.on))))
    throw new TypeError(`${owner} trigger has an unsupported stage ${trigger.on}.`);
  const reactions = [trigger.emit != null, trigger.invoke != null, trigger.run != null].filter(Boolean).length;
  if (reactions !== 1) throw new TypeError(`${owner} trigger must declare exactly one of emit, invoke, or run.`);
  if (trigger.run != null && typeof trigger.run !== 'function')
    throw new TypeError(`${owner} trigger run must be a function.`);
  if (trigger.when != null && typeof trigger.when !== 'function')
    throw new TypeError(`${owner} trigger when must be a function.`);
  for (const key of ['emit', 'invoke'] as const) {
    const id = trigger[key];
    if (
      id != null &&
      (!['string', 'number'].includes(typeof id) ||
        !String(id).trim() ||
        (typeof id === 'number' && !Number.isFinite(id)))
    )
      throw new TypeError(`${owner} trigger ${key} must be a skill/profile id.`);
  }

  if (trigger.effects != null && typeof trigger.effects !== 'function')
    throw new TypeError(`${owner} trigger effects must be a function.`);
  if (trigger.announce != null && typeof trigger.announce !== 'boolean')
    throw new TypeError(`${owner} trigger announce must be boolean.`);
  if (trigger.order != null && !Number.isFinite(trigger.order))
    throw new TypeError(`${owner} trigger order must be finite.`);
  if (trigger.emit == null && (trigger.effects != null || trigger.attribution != null))
    throw new TypeError(`${owner} trigger effects and attribution apply only to emit.`);
  if (trigger.invoke == null && trigger.announce != null)
    throw new TypeError(`${owner} trigger announce applies only to invoke.`);
  if (trigger.requiresSelection != null && typeof trigger.requiresSelection !== 'boolean')
    throw new TypeError(`${owner} trigger requiresSelection must be boolean.`);
  if (trigger.cooldown != null && !['profile', 'skill'].includes(trigger.cooldown))
    throw new TypeError(`${owner} trigger cooldown must be profile or skill.`);
  if (trigger.cooldown === 'skill' && trigger.invoke == null)
    throw new TypeError(`${owner} trigger cooldown skill requires invoke.`);
  if (point && trigger.order != null)
    throw new TypeError(`${owner} trigger on ${trigger.on.id} cannot set order; the point owns it.`);
}

/** Compile once; declaration order breaks equal-order ties and live profile lookups keep patches authoritative. */
export function compileRechargeRules<T extends object, TSkill extends Skill = Skill>(
  rules: readonly RechargeRule<T, TSkill>[]
): (runtime: MechanicQueryContext<T, TSkill>, skill: TSkill, work: number) => number {
  const ordered = [...rules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (runtime, skill, work) => {
    for (const rule of ordered)
      if ((rule.trait == null || hasTrait(runtime, rule.trait)) && rule.when(runtime, skill))
        work *= sideEffectAmount(runtime, rule.multiplier);
    return work;
  };
}

/** The selection gate precedes `when`; intrinsic listeners opt out explicitly. */
function selected(runtime: object, rule: LooseTrigger): boolean {
  return rule.requiresSelection === false || hasTrait(runtime, rule.trait);
}

/** Admit after selection and eligibility; a skill cooldown reserves the shared recharge before any packet exists. */
function admitCooldown(runtime: MechanicContext, rule: LooseTrigger): boolean {
  if (rule.cooldown === 'profile') return runtime.procs.claim(rule.emit ?? rule.trait);
  if (rule.cooldown === 'skill') {
    const skill = runtime.helpers.skillsById.get(rule.invoke!);
    if (!skill) throw new TypeError(`Trait ${rule.trait} invokes unknown skill ${rule.invoke}.`);
    // A removed payload leaves the shared recharge untouched, exactly as a direct cast would.
    if (!skill.effects?.length || runtime.cooldownController.isOnCooldown(skill.id, runtime.time)) return false;
    runtime.cooldownController.startRecharge(skill, runtime.time);
  }

  return true;
}

function resolveAttribution(
  rule: LooseTrigger,
  runtime: MechanicContext,
  trigger: unknown
): TraitAttribution | undefined {
  return typeof rule.attribution === 'function'
    ? (rule.attribution as (runtime: unknown, trigger: unknown) => TraitAttribution)(runtime.queries, trigger)
    : rule.attribution;
}

/** A cast-stage invocation keeps the accepted action as its trigger, without adopting the cast's activation. */
function castCause(runtime: MechanicContext, cast: RuntimeCast): Gw2ResolverEvent {
  return {
    type: 'action',
    at: runtime.time,
    source: 'Trait',
    sourceId: cast.skill.id,
    actorType: 'player',
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id
  };
}

/** Compile only hook contributions at their module position; committed interruptions receive the same cast rewards. */
export function compileProfessionRules<T extends object, TSkill extends Skill = Skill>(
  hooks: RuntimeHooks<T, TSkill>,
  { traitTriggers = true }: ProfessionRuntimeOptions = {}
): RuntimeHooks<T, TSkill> {
  const compiled = { ...hooks };
  if (hooks.rechargeRules?.length) {
    const recharge = compileRechargeRules(hooks.rechargeRules);
    compiled.rechargeWork = (runtime, skill, work) => {
      const adjusted = recharge(runtime, skill, work);
      return hooks.rechargeWork?.(runtime, skill, adjusted) ?? adjusted;
    };
  }

  // Omit activation producers at composition time while keeping recharge and authored payload hooks intact.
  // Point listeners compile separately, across modules, in their point's declared order.
  const stageTriggers = (traitTriggers ? ((hooks.traitTriggers ?? []) as readonly LooseTrigger[]) : []).filter(
    (rule) => !isTriggerPoint(rule.on)
  );
  for (const rule of [...stageTriggers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).reverse()) {
    // Wrapping in reverse declaration order keeps reactions in declaration order before the imperative owner.
    if (rule.on === 'castStart' || rule.on === 'castCommit') {
      const key = rule.on === 'castStart' ? 'onCastStart' : 'onCastCommit';
      const prior = compiled[key];
      compiled[key] = (runtime, cast) => {
        // The runtime dispatches commit hooks only for successful casts, including shortened animations.
        const context = runtime as unknown as MechanicContext;
        if (
          selected(runtime, rule) &&
          (rule.when?.(runtime.queries as never, cast as never) ?? true) &&
          admitCooldown(context, rule)
        ) {
          if (rule.run) rule.run(runtime as never, cast as never);
          else if (rule.invoke != null)
            invokeTraitSkill(runtime, rule.trait, rule.invoke, castCause(context, cast), { announce: rule.announce });
          else
            emitTraitProfile(runtime, rule.trait, rule.emit!, undefined, {
              skillId: cast.skill.id,
              skillName: cast.skill.name,
              activationId: cast.id,
              effects: rule.effects,
              attribution: resolveAttribution(rule, context, cast)
            });
        }

        prior?.(runtime, cast);
      };
    } else {
      const stage = rule.on as Gw2ResolverStage;
      const prior = compiled.reactions?.[stage];
      compiled.reactions = {
        ...compiled.reactions,
        [stage]: (runtime: MechanicContext<T, TSkill>, event: Gw2ResolverEvent, details: Record<string, unknown>) => {
          const context = runtime as unknown as MechanicContext;
          // Hit predicates consume the resolved outcome, never a prediction from the packet.
          if (
            selected(runtime, rule) &&
            (rule.when?.(runtime.queries as never, event as never, details as never) ?? true) &&
            admitCooldown(context, rule)
          ) {
            if (rule.run) rule.run(runtime as never, event as never, details as never);
            else if (rule.invoke != null)
              invokeTraitSkill(runtime, rule.trait, rule.invoke, event, { announce: rule.announce });
            else
              emitTraitProfile(runtime, rule.trait, rule.emit!, event, {
                effects: rule.effects,
                attribution: resolveAttribution(rule, context, event)
              });
          }

          return prior?.(runtime, event, details);
        }
      };
    }
  }

  return compiled;
}

/**
 * Build each point's listener table for the selected modules. The point's list orders listeners across Core and
 * elite traits; profession compilation has already proven the list complete.
 */
export function compileTriggerPoints<T extends object, TSkill extends Skill = Skill>(
  triggers: readonly TraitTrigger<T, TSkill>[]
): ReadonlyMap<string, readonly TriggerListener<T, TSkill>[]> {
  const byPoint = new Map<string, { point: TriggerPoint; rules: LooseTrigger[] }>();
  for (const rule of triggers as readonly LooseTrigger[]) {
    if (!isTriggerPoint(rule.on)) continue;
    const entry = byPoint.get(rule.on.id) ?? { point: rule.on, rules: [] };
    entry.rules.push(rule);
    byPoint.set(rule.on.id, entry);
  }

  const table = new Map<string, readonly TriggerListener<T, TSkill>[]>();
  for (const [id, { point, rules }] of byPoint) {
    const position = (rule: LooseTrigger) => point.order.findIndex((trait) => String(trait) === String(rule.trait));
    const listeners = [...rules]
      .sort((a, b) => position(a) - position(b))
      .map((rule): TriggerListener<T, TSkill> => (runtime, input) => {
        const context = runtime as unknown as MechanicContext;
        if (!selected(runtime, rule) || !(rule.when?.(runtime.queries as never, input as never) ?? true)) return;
        // A malformed declarative boundary must fail before consuming a proc claim or skill recharge.
        const cause = rule.run ? undefined : (input as { readonly cause?: Gw2ResolverEvent }).cause;
        if (!rule.run && (!cause || typeof cause !== 'object' || !Number.isFinite(cause.at)))
          throw new TypeError(`Trigger point ${id} must carry a cause with a finite time for trait ${rule.trait}.`);
        if (!admitCooldown(context, rule)) return;
        if (rule.run) {
          rule.run(runtime as never, input as never);
          return;
        }

        // Declarative payloads need the resolver event or accepted action that caused the boundary.
        if (rule.invoke != null)
          invokeTraitSkill(runtime, rule.trait, rule.invoke, cause!, { announce: rule.announce });
        else
          emitTraitProfile(runtime, rule.trait, rule.emit!, cause, {
            effects: rule.effects,
            attribution: resolveAttribution(rule, context, input)
          });
      });
    table.set(id, Object.freeze(listeners));
  }

  return table;
}

/**
 * Prove every point's order list across all modules of a profession: each listener is listed once, each listed trait
 * listens, and one id names one point.
 */
export function validateTriggerPoints(triggers: readonly { readonly trait: SkillId; readonly on: unknown }[]): void {
  const points = new Map<string, { point: TriggerPoint; traits: Set<string> }>();
  for (const rule of triggers) {
    if (!isTriggerPoint(rule.on)) continue;
    const point = rule.on;
    const entry = points.get(point.id) ?? { point, traits: new Set<string>() };
    if (entry.point !== point) throw new TypeError(`Trigger point ${point.id} is declared more than once.`);
    const trait = String(rule.trait);
    if (!point.order.some((listed) => String(listed) === trait))
      throw new TypeError(`Trait ${trait} listens to ${point.id} but is missing from its order.`);
    if (entry.traits.has(trait)) throw new TypeError(`Trait ${trait} listens to ${point.id} more than once.`);
    entry.traits.add(trait);
    points.set(point.id, entry);
  }

  for (const { point, traits } of points.values())
    for (const listed of point.order)
      if (!traits.has(String(listed)))
        throw new TypeError(`Trigger point ${point.id} lists trait ${listed}, which has no listener.`);
}
