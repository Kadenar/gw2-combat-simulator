/** Owns equipped and precast instances, query access, and lifecycle dispatch without changing event order. */
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { normalizePrecastRelics, relicIdForName } from '#gw2/platform/equipment/relics/catalog.js';
import { createAristocracyPreviewState } from '#gw2/platform/equipment/relics/rules/aristocracy.js';
import { RELIC_RULES } from '#gw2/platform/equipment/relics/rules/index.js';
import type {
  Gw2RelicQueryOwner,
  Gw2RelicRule,
  Gw2RelicRuntime,
  Gw2RelicState
} from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

const STATELESS_RELIC: Readonly<Gw2RelicRule> = Object.freeze({});

interface RelicInstance {
  readonly id: number | null;
  readonly rules: Readonly<Gw2RelicRule>;
  readonly state: Gw2RelicState;
}

function createInstance(name: unknown): RelicInstance {
  const id = relicIdForName(name);
  const rules = (id == null ? undefined : RELIC_RULES[id]) || STATELESS_RELIC;
  return { id, rules, state: rules.createState?.() || {} };
}

/** All live contributions use the same owned state; only strike buffs include precast instances. */
function queryOwner(equipped: RelicInstance, precasts: readonly RelicInstance[] = []): Gw2RelicQueryOwner {
  const { rules, state } = equipped;
  return Object.freeze({
    id: equipped.id,
    queries: Object.freeze({
      strikeMultiplier: (context, event) =>
        precasts.reduce(
          (multiplier, relic) => multiplier * (relic.rules.strikeMultiplier?.(context, relic.state, event) ?? 1),
          rules.strikeMultiplier?.(context, state, event) ?? 1
        ),
      outgoingDamageBonus: (context, damageType, at, event) =>
        rules.outgoingDamageBonus?.(context, state, damageType, at, event) ?? 0,
      criticalChanceBonus: (context, event, mightStacks) =>
        rules.criticalChanceBonus?.(context, state, event, mightStacks) ?? 0,
      conditionDurationBonus: (context, at) => rules.conditionDurationBonus?.(context, state, at) ?? 0,
      conditionDamageBonus: (context, at) => rules.conditionDamageBonus?.(context, state, at) ?? 0,
      concentrationBonus: (context, at) => rules.concentrationBonus?.(context, state, at) ?? 0
    } satisfies Gw2RelicQueryOwner['queries'])
  });
}

/** A relic selected for both roles shares one state, including cooldowns claimed before combat. */
export function createRelicRuntime(name: unknown, precastNames: readonly string[] = []): Readonly<Gw2RelicRuntime> {
  const equipped = createInstance(name);
  const precasts = normalizePrecastRelics(precastNames)
    .map(createInstance)
    .filter((relic) => relic.id !== equipped.id);
  const instances = [equipped, ...precasts];
  const { rules, state } = equipped;
  const { emitActionEffects, action, afterHit, precombatStrike, control, condition } = rules;
  return Object.freeze({
    ...queryOwner(equipped, precasts),
    buffPolicies: Object.freeze(instances.flatMap((relic) => relic.rules.buffPolicies ?? [])),
    setCombatMarker(event) {
      for (const relic of instances) relic.state.combatMarker = event;
    },
    completed(context, event) {
      for (const relic of instances) relic.rules.completed?.(context, relic.state, event);
    },
    // Hooks whose callers derive inputs exist only when the equipped rule observes them, so most relics skip that work.
    action:
      emitActionEffects || action
        ? (context, event, skill) => {
            if (!event.cancelled) emitActionEffects?.(context, state, event, skill);

            action?.(context, state, event);
          }
        : undefined,
    afterHit: afterHit && ((context, event, skill) => afterHit(context, state, event, skill)),
    precombatStrike: precombatStrike && ((context, event, skill) => precombatStrike(context, state, event, skill)),
    control: control && ((context, event, helpers) => control(context, state, event, helpers)),
    condition: condition && ((context, event, helpers) => condition(context, state, event, helpers)),
    emitConditionEffects: (context, event) => {
      rules.emitConditionEffects?.(context, state, event);
    },
    activate(context, event) {
      // Earned delayed work retains its original owner even after preparation ends.
      const relic = instances.find((entry) => entry.id === event.sourceId);

      if (relic) relic.rules.activate?.(context, relic.state, event);
    },
    passiveTimeline: (context, end) => {
      rules.passiveTimeline?.(context, state, end);
    },
    boon(context, event) {
      if (!isStandardBoon(event.kind || event.boon)) return;

      for (const relic of instances) relic.rules.boon?.(context, relic.state, event);
    },
    combo: (context, event) => {
      rules.combo?.(context, state, event);
    },
    damageResolved: (context, event) => {
      rules.damageResolved?.(context, state, event);
    },
    damagePayload(context, event, inputs) {
      const relic = instances.find((entry) => entry.id === event.sourceId);

      if (!relic?.rules.damagePayload) return false;

      relic.rules.damagePayload(context, relic.state, event, inputs);
      return true;
    }
  } satisfies Gw2RelicRuntime);
}

/** Detached queries retain the equipped relic's base context, without replaying earned stacks or precast buffs. */
export function createRelicTimelineQueries(name: unknown, events: readonly SimulationEvent[]): Gw2RelicQueryOwner {
  const relic = createInstance(name);
  relic.state.timelineEvents = events;
  return queryOwner(relic);
}

/** Attribute controls may assume an Aristocracy window without accessing a live simulation's mutable state. */
export function createAristocracyPreviewQueries(stacks: number): Gw2RelicQueryOwner {
  // The rule owns its state layout; this owner only binds the assumed window to the shared query surface.
  const { id, rules } = createInstance('Aristocracy');
  return queryOwner({ id, rules, state: createAristocracyPreviewState(stacks) });
}
