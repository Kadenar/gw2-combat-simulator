/** The actual preview result exposes detached facts and cannot grant runtime access or accept a callback. */
import { CONDITION } from '#gw2/platform/constants.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';
import { queryDamagePreview } from '#gw2/platform/skill-damage/query-preview.js';

declare const profession: Gw2ProfessionSource;
const facts = queryDamagePreview(profession, {}, {});
const power: number = facts.stats.power;
const poisonDuration: number = facts.conditionDurationMultipliers[CONDITION.POISONED];
void power;
void poisonDuration;

// @ts-expect-error Calculation callers cannot receive the prepared runtime through a callback.
queryDamagePreview(profession, {}, {}, () => 0);
// @ts-expect-error Detached facts expose no live runtime.
facts.runtime;
// @ts-expect-error Callers cannot invoke runtime queries.
facts.query;
// @ts-expect-error Callers cannot publish effects.
facts.effects;
// @ts-expect-error Returned scalar facts are readonly.
facts.criticalChanceBeforeCap = 0;
// @ts-expect-error Nested stat facts are readonly.
facts.stats.power = 0;
// @ts-expect-error Nested duration facts are readonly.
facts.conditionDurationMultipliers[CONDITION.POISONED] = 0;
