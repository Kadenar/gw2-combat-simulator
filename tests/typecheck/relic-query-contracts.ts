import {
  relicConditionDamageBonus,
  relicConditionDurationBonus,
  relicCriticalChanceBonus,
  relicOutgoingDamageBonus,
  relicStrikeMultiplier
} from '#gw2/platform/equipment/relics/query.js';
import { createRelicRuntime, createRelicTimelineQueries } from '#gw2/platform/equipment/relics/runtime.js';
import type { Gw2RelicAttributeQueryContext, Gw2RelicContext } from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

declare const event: SimulationEvent;
declare const attributeContext: Gw2RelicAttributeQueryContext;
declare const effectContext: Gw2RelicContext;
const relic = createRelicRuntime('Thorns');

// Queries accept only their observations; callers need no emission service or fabricated runtime.
relicConditionDamageBonus({ config: { initialThornsStacks: 2 }, relic }, 0);
relicConditionDurationBonus({ relic, buffs: new Map() }, 0);
relicCriticalChanceBonus({ relic }, event, 0);
relicOutgoingDamageBonus({ relic }, 0);
relicStrikeMultiplier(
  { relic, config: {}, totals: { strike: 0, condition: 0 }, helpers: effectContext.helpers },
  event
);

// @ts-expect-error Thorns needs configuration even when a relic runtime is present.
relicConditionDamageBonus({ relic }, 0);
// @ts-expect-error Bound queries still require the rule's configuration observations.
relic.queries.conditionDamageBonus({ relic }, 0);
// @ts-expect-error Mutable instances never leave the owner.
relic.state;
// @ts-expect-error Callers cannot dispatch rules against arbitrary state.
relic.rules;
const historical = createRelicTimelineQueries('Thorns', []);
// @ts-expect-error Detached historical observations cannot mutate gameplay state.
historical.completed(effectContext, event);
// @ts-expect-error Typed hooks reject a timestamp where a completed action is required.
relic.completed(effectContext, 0);
// @ts-expect-error Attribute queries cannot emit gameplay effects.
attributeContext.effects.emit({ kind: 'packet', event });
