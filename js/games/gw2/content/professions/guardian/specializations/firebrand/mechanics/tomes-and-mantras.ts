import { attributeProvenance } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { GUARDIAN_TRAIT_IDS } from '#gw2/content/professions/guardian/data/ids.js';
import { guardianBoonActive } from '#gw2/content/professions/guardian/core/traits/modifiers.js';
import {
  advanceTomeState,
  tomePageAvailability,
  tomeStateAvailability
} from '#gw2/content/professions/guardian/specializations/firebrand/mechanics/tomes.js';
import {
  observeFirebrandScheduledEvent,
  updateFirebrandCastState
} from '#gw2/content/professions/guardian/specializations/firebrand/traits/index.js';
import {
  advanceFirebrandMantras,
  completeFirebrandMantra,
  firebrandMantraAvailability,
  initializeFirebrandMantras
} from '#gw2/content/professions/guardian/specializations/firebrand/skills/mantras.js';
import { initializeFirebrandBalanceState } from '#gw2/content/professions/guardian/specializations/firebrand/state.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';

export const firebrandModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'guardian.firebrand.imbued-haste-attributes',
    label: 'Imbued Haste',
    target: [
      MODIFIER_TARGET.ATTRIBUTE_CONDITION_DAMAGE,
      MODIFIER_TARGET.ATTRIBUTE_HEALING_POWER,
      MODIFIER_TARGET.ATTRIBUTE_VITALITY
    ],
    operation: 'add',
    parameters: { attributeBonus: 250 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) => {
      const staticApplied = attributeProvenance(context.config).professionStaticRulesApplied;
      const runtimeActive = guardianBoonActive(context, 'quickness');
      const staticallyActive = staticApplied && Boolean(context.config?.boons?.quickness);
      return (Number(runtimeActive) - Number(staticallyActive)) * parameters.attributeBonus;
    },
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.IMBUED_HASTE)
  }
]);

export const firebrandAttributeRules = Object.freeze({
  modifierRules: firebrandModifierRules
});

export const firebrandCastRules = Object.freeze({
  availability: Object.freeze([
    {
      id: 'guardian.firebrand.mantras',
      order: 20,
      handler: firebrandMantraAvailability
    },
    {
      id: 'guardian.tome-state',
      order: 30,
      handler: tomeStateAvailability
    },
    {
      id: 'guardian.tome-pages',
      order: 40,
      handler: tomePageAvailability
    }
  ])
});

export const firebrandSchedulerHooks = Object.freeze({
  initialize: Object.freeze([
    {
      id: 'guardian.firebrand.balance-state',
      order: 5,
      handler: initializeFirebrandBalanceState
    },
    {
      id: 'guardian.firebrand.mantras',
      order: 10,
      handler: initializeFirebrandMantras
    }
  ]),
  advance: Object.freeze([
    {
      id: 'guardian.firebrand.mantras',
      order: 5,
      handler: advanceFirebrandMantras
    },
    {
      id: 'guardian.tomes',
      order: 10,
      handler: advanceTomeState
    }
  ]),
  afterCast: Object.freeze([
    {
      id: 'guardian.firebrand.traits',
      order: 30,
      handler: updateFirebrandCastState
    }
  ]),
  onCastComplete: Object.freeze([
    {
      id: 'guardian.firebrand.mantras',
      order: 20,
      handler: completeFirebrandMantra
    }
  ]),
  onEventScheduled: Object.freeze([
    {
      id: 'guardian.firebrand.traits',
      order: 20,
      handler: observeFirebrandScheduledEvent
    }
  ])
});
