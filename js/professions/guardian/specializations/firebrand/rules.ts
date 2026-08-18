import { attributeProvenance } from '../../../../platform/gw2/attribute-provenance.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/modifier-rules.js';
import { GUARDIAN_TRAIT_IDS } from '../../data/ids.js';
import { guardianBoonActive } from '../../core/rules.js';
import { advanceTomeState, tomePageAvailability, validateTomeCast } from './tomes.js';
import { observeFirebrandScheduledEvent, updateFirebrandCastState } from './traits.js';
import {
  advanceFirebrandMantras,
  completeFirebrandMantra,
  firebrandMantraAvailability,
  initializeFirebrandMantras
} from './mantras.js';
import { initializeFirebrandBalanceState } from './state.js';
import type { Gw2ModifierRule } from '../../../../platform/gw2/types.js';

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
      id: 'guardian.tome-pages',
      order: 30,
      handler: tomePageAvailability
    }
  ]),
  validateCast: Object.freeze([
    {
      id: 'guardian.tomes',
      order: 30,
      handler: validateTomeCast
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
