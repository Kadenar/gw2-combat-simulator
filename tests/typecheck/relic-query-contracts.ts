import {
  relicConditionDamageBonus,
  relicConditionDurationBonus,
  relicCriticalChanceBonus,
  relicOutgoingDamageBonus,
  relicStrikeMultiplier
} from '#gw2/platform/equipment/relics/query.js';
import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
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
relicOutgoingDamageBonus({ relic }, 'condition', 0);
relicStrikeMultiplier({ relic, config: {}, totals: { strike: 0, condition: 0 } }, event);

// @ts-expect-error Thorns needs configuration even when a relic runtime is present.
relicConditionDamageBonus({ relic }, 0);
// @ts-expect-error Calling the rule directly must enforce the same configuration requirement.
relic.rules.conditionDamageBonus?.({ relic }, relic.state, 0);
// @ts-expect-error Typed hooks reject a timestamp where a completed action is required.
relic.rules.completed?.(effectContext, relic.state, 0);
// @ts-expect-error Attribute queries cannot emit gameplay effects.
attributeContext.effects.emit({ kind: 'packet', event });
