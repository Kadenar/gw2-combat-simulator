import {
  STATUS,
  COMBO_FIELD,
  COMBO_FINISHER,
  AURA,
  CONTROL,
  RECIPIENT,
  BOON,
  CONDITION,
  type ComboFieldType,
  type ComboFinisherType
} from '#gw2/platform/constants.js';
import type { ComboEvent } from '#gw2/platform/combos/types.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { COMBO_FIELD_TYPES, COMBO_FINISHER_TYPES } from '#gw2/platform/combos/types.js';

const COMBO_COMBAT_METADATA_FIELDS = Object.freeze([
  // Combo conditions share the finisher's damage row even when its cast uses a variant name.
  'damageBreakdownName',
  // A missed finisher can still grant self effects, but its hostile outcomes must also miss.
  'offTarget',
  'ownerActorType',
  'summonKind',
  'summonOwner',
  // Combo conditions belong to the named finisher owner, including a pet that has since swapped out.
  'entityName',
  'independentSummonStrike',
  'independentConditionOwner',
  'summonInheritsAttributes',
  'summonInheritsCriticalAttributes',
  'summonIgnoresBoons',
  'summonUsesMight',
  'summonUsesEquipmentModifiers',
  'summonUsesProfessionModifiers',
  'summonBasePower',
  'summonBasePrecision',
  'summonBaseFerocity',
  'summonBaseConditionDamage',
  'summonBaseExpertise',
  'summonCriticalChance',
  'summonCriticalDamage',
  'summonDamagePerCoefficient'
]);

/** Carries finisher ownership and summon scaling through semantic combo events and outcomes. */
export function comboCombatMetadata(event: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const metadata: Record<string, unknown> = {};
  for (const field of COMBO_COMBAT_METADATA_FIELDS) {
    if (event[field] !== undefined) metadata[field] = event[field];
  }

  return metadata;
}

type ComboOutcome =
  | {
      readonly kind: 'aura';
      readonly name: string;
      readonly aura: string;
      readonly duration: number;
    }
  | {
      readonly kind: 'boon';
      readonly name: string;
      readonly boon: string;
      readonly stacks: number;
      readonly duration: number;
    }
  | {
      readonly kind: 'condition';
      readonly name: string;
      readonly condition: string;
      readonly stacks: number;
      readonly duration: number;
    }
  | {
      readonly kind: 'control';
      readonly name: string;
      readonly control: string;
    }
  | {
      readonly kind: 'life-steal';
      readonly name: string;
      readonly icon?: string;
      readonly flatStrikeBase: number;
      readonly flatStrikePowerCoeff: number;
    }
  | {
      readonly kind: 'cleanse';
      readonly name: string;
      readonly conditions: number;
    }
  | {
      readonly kind: 'healing';
      readonly name: string;
    }
  | {
      readonly kind: typeof STATUS.STEALTH;
      readonly name: string;
      readonly duration: number;
    };

interface ComboDefinition {
  readonly fieldType: ComboFieldType;
  readonly finisherType: ComboFinisherType;
  readonly outcome: ComboOutcome;
}

const aura = (name: string, duration: number): ComboOutcome =>
  Object.freeze({ kind: 'aura', name, aura: name, duration });
const boon = (name: string, boonName: string, stacks: number, duration: number): ComboOutcome =>
  Object.freeze({ kind: 'boon', name, boon: boonName, stacks, duration });
const condition = (name: string, conditionName: string, stacks: number, duration: number): ComboOutcome =>
  Object.freeze({
    kind: 'condition',
    name,
    condition: conditionName,
    stacks,
    duration
  });
const cleanse = (name: string): ComboOutcome => Object.freeze({ kind: 'cleanse', name, conditions: 1 });
const stealth = (name: string): ComboOutcome => Object.freeze({ kind: STATUS.STEALTH, name, duration: 3 });
// Healing combos retain their identity for proc handling; player health is fixed at full.
const healing = (name: string): ComboOutcome => Object.freeze({ kind: 'healing', name });
const lifeSteal = (name: string, flatStrikeBase: number, icon?: string): ComboOutcome =>
  Object.freeze({
    kind: 'life-steal',
    name,
    icon,
    flatStrikeBase,
    flatStrikePowerCoeff: 0.03
  });

const definitions: readonly ComboDefinition[] = [
  { fieldType: COMBO_FIELD.DARK, finisherType: COMBO_FINISHER.BLAST, outcome: aura(AURA.DARK, 3) },
  { fieldType: COMBO_FIELD.DARK, finisherType: COMBO_FINISHER.LEAP, outcome: aura(AURA.DARK, 5) },
  {
    fieldType: COMBO_FIELD.DARK,
    finisherType: COMBO_FINISHER.PROJECTILE,
    // Projectile siphons have their own damage identity; Leeching Bolts belongs to whirls.
    outcome: lifeSteal('Life Siphon Damage', 202)
  },
  {
    fieldType: COMBO_FIELD.DARK,
    finisherType: COMBO_FINISHER.WHIRL,
    // Combat-log-only Leeching Bolts uses the healing artwork, as in Elite Insights.
    outcome: lifeSteal(
      'Leeching Bolts',
      170,
      'https://render.guildwars2.com/file/D4347C52157B040943051D7E09DEAD7AF63D4378/156662.png'
    )
  },
  {
    fieldType: COMBO_FIELD.ETHEREAL,
    finisherType: COMBO_FINISHER.BLAST,
    outcome: aura(AURA.CHAOS, 3)
  },
  {
    fieldType: COMBO_FIELD.ETHEREAL,
    finisherType: COMBO_FINISHER.LEAP,
    outcome: aura(AURA.CHAOS, 5)
  },
  {
    fieldType: COMBO_FIELD.ETHEREAL,
    finisherType: COMBO_FINISHER.PROJECTILE,
    outcome: condition(CONDITION.CONFUSION, CONDITION.CONFUSION, 1, 5)
  },
  {
    fieldType: COMBO_FIELD.ETHEREAL,
    finisherType: COMBO_FINISHER.WHIRL,
    outcome: condition('Confounding Bolts', CONDITION.CONFUSION, 1, 5)
  },
  {
    fieldType: COMBO_FIELD.FIRE,
    finisherType: COMBO_FINISHER.BLAST,
    outcome: boon('Area Might', BOON.MIGHT, 3, 20)
  },
  { fieldType: COMBO_FIELD.FIRE, finisherType: COMBO_FINISHER.LEAP, outcome: aura(AURA.FIRE, 5) },
  {
    fieldType: COMBO_FIELD.FIRE,
    finisherType: COMBO_FINISHER.PROJECTILE,
    outcome: condition(CONDITION.BURNING, CONDITION.BURNING, 1, 1)
  },
  {
    fieldType: COMBO_FIELD.FIRE,
    finisherType: COMBO_FINISHER.WHIRL,
    outcome: condition('Burning Bolts', CONDITION.BURNING, 1, 1)
  },
  { fieldType: COMBO_FIELD.ICE, finisherType: COMBO_FINISHER.BLAST, outcome: aura(AURA.FROST, 3) },
  { fieldType: COMBO_FIELD.ICE, finisherType: COMBO_FINISHER.LEAP, outcome: aura(AURA.FROST, 5) },
  {
    fieldType: COMBO_FIELD.ICE,
    finisherType: COMBO_FINISHER.PROJECTILE,
    outcome: condition(CONDITION.CHILLED, CONDITION.CHILLED, 1, 1)
  },
  {
    fieldType: COMBO_FIELD.ICE,
    finisherType: COMBO_FINISHER.WHIRL,
    outcome: condition('Chilling Bolts', CONDITION.CHILLED, 1, 1)
  },
  {
    fieldType: COMBO_FIELD.LIGHT,
    finisherType: COMBO_FINISHER.BLAST,
    outcome: cleanse('Area Cleanse')
  },
  { fieldType: COMBO_FIELD.LIGHT, finisherType: COMBO_FINISHER.LEAP, outcome: aura(AURA.LIGHT, 5) },
  {
    fieldType: COMBO_FIELD.LIGHT,
    finisherType: COMBO_FINISHER.PROJECTILE,
    outcome: cleanse('Cleanse')
  },
  {
    fieldType: COMBO_FIELD.LIGHT,
    finisherType: COMBO_FINISHER.WHIRL,
    outcome: cleanse('Cleansing Bolts')
  },
  {
    fieldType: COMBO_FIELD.LIGHTNING,
    finisherType: COMBO_FINISHER.BLAST,
    outcome: boon('Area Swiftness', BOON.SWIFTNESS, 1, 10)
  },
  {
    fieldType: COMBO_FIELD.LIGHTNING,
    finisherType: COMBO_FINISHER.LEAP,
    outcome: Object.freeze({
      kind: 'control',
      name: 'Dazing Strike',
      control: CONTROL.DAZE
    })
  },
  {
    fieldType: COMBO_FIELD.LIGHTNING,
    finisherType: COMBO_FINISHER.PROJECTILE,
    outcome: condition(CONDITION.VULNERABILITY, CONDITION.VULNERABILITY, 2, 5)
  },
  {
    fieldType: COMBO_FIELD.LIGHTNING,
    finisherType: COMBO_FINISHER.WHIRL,
    outcome: condition('Brutal Bolts', CONDITION.VULNERABILITY, 2, 5)
  },
  {
    fieldType: COMBO_FIELD.POISON,
    finisherType: COMBO_FINISHER.BLAST,
    outcome: condition('Area Weakness', CONDITION.WEAKNESS, 1, 3)
  },
  {
    fieldType: COMBO_FIELD.POISON,
    finisherType: COMBO_FINISHER.LEAP,
    outcome: condition(CONDITION.WEAKNESS, CONDITION.WEAKNESS, 1, 8)
  },
  {
    fieldType: COMBO_FIELD.POISON,
    finisherType: COMBO_FINISHER.PROJECTILE,
    outcome: condition(CONDITION.POISONED, CONDITION.POISONED, 1, 2)
  },
  {
    fieldType: COMBO_FIELD.POISON,
    finisherType: COMBO_FINISHER.WHIRL,
    outcome: condition('Poison Bolts', CONDITION.POISONED, 1, 2)
  },
  {
    fieldType: COMBO_FIELD.SMOKE,
    finisherType: COMBO_FINISHER.BLAST,
    outcome: stealth('Area Stealth')
  },
  { fieldType: COMBO_FIELD.SMOKE, finisherType: COMBO_FINISHER.LEAP, outcome: stealth('Stealth') },
  {
    fieldType: COMBO_FIELD.SMOKE,
    finisherType: COMBO_FINISHER.PROJECTILE,
    outcome: Object.freeze({
      kind: 'condition',
      name: CONDITION.BLINDNESS,
      condition: CONDITION.BLINDNESS,
      stacks: 1,
      duration: 3
    })
  },
  {
    fieldType: COMBO_FIELD.SMOKE,
    finisherType: COMBO_FINISHER.WHIRL,
    outcome: Object.freeze({
      kind: 'condition',
      name: 'Blinding Bolts',
      condition: CONDITION.BLINDNESS,
      stacks: 1,
      duration: 3
    })
  },
  {
    fieldType: COMBO_FIELD.WATER,
    finisherType: COMBO_FINISHER.BLAST,
    outcome: healing('Area Healing')
  },
  {
    fieldType: COMBO_FIELD.WATER,
    finisherType: COMBO_FINISHER.LEAP,
    outcome: healing('Healing')
  },
  {
    fieldType: COMBO_FIELD.WATER,
    finisherType: COMBO_FINISHER.PROJECTILE,
    outcome: boon(BOON.REGENERATION, BOON.REGENERATION, 1, 2)
  },
  {
    fieldType: COMBO_FIELD.WATER,
    finisherType: COMBO_FINISHER.WHIRL,
    outcome: boon('Healing Bolts', BOON.REGENERATION, 1, 2)
  }
].map((definition) => Object.freeze(definition) as ComboDefinition);

/** Validates combo definition uniqueness, coverage, and outcome data. */
export function validateComboDefinitions(values: readonly ComboDefinition[]): readonly ComboDefinition[] {
  const keys = new Set<string>();
  for (const definition of values) {
    const key = `${definition.fieldType}|${definition.finisherType}`;

    if (keys.has(key)) throw new TypeError(`Duplicate combo definition: ${key}.`);

    keys.add(key);

    if (!definition.outcome?.kind || !definition.outcome.name) {
      throw new TypeError(`Combo definition ${key} requires an outcome.`);
    }
  }

  const expected = COMBO_FIELD_TYPES.length * COMBO_FINISHER_TYPES.length;

  if (values.length !== expected || keys.size !== expected) {
    throw new TypeError(`Combo definitions require all ${expected} field/finisher pairs.`);
  }

  for (const fieldType of COMBO_FIELD_TYPES) {
    for (const finisherType of COMBO_FINISHER_TYPES) {
      const key = `${fieldType}|${finisherType}`;

      if (!keys.has(key)) throw new TypeError(`Missing combo definition: ${key}.`);
    }
  }

  return values;
}

export const COMBO_DEFINITIONS = Object.freeze([...validateComboDefinitions(definitions)]);

const DEFINITION_BY_KEY = new Map(
  COMBO_DEFINITIONS.map((definition) => [`${definition.fieldType}|${definition.finisherType}`, definition])
);

/** Returns the canonical outcome definition for a field and finisher pair. */
export function comboDefinition(fieldType: ComboFieldType, finisherType: ComboFinisherType): ComboDefinition {
  const definition = DEFINITION_BY_KEY.get(`${fieldType}|${finisherType}`);

  if (!definition) {
    throw new TypeError(`Missing combo definition: ${fieldType}/${finisherType}.`);
  }

  return definition;
}

interface ComboOutcomeEventBase extends Pick<
  ComboEvent,
  | 'skillId'
  | 'skillName'
  | 'parentSkillName'
  | 'activationId'
  | 'comboId'
  | 'attemptId'
  | 'fieldId'
  | 'fieldType'
  | 'fieldSourceId'
  | 'fieldSource'
  | 'fieldOwnerId'
  | 'finisherType'
> {
  readonly at: number;
  readonly source: string;
  readonly sourceId: SkillId;
  /** Outcomes preserve the combo's actor rather than deriving it from display metadata. */
  readonly actorType: ComboEvent['actorType'];
  readonly priority?: ComboEvent['priority'];
  readonly triggeredBy: string;
}

function inheritedComboFields(combo: ComboEvent): ComboOutcomeEventBase {
  return {
    ...comboCombatMetadata(combo),
    // Combo boons and other outcomes resolve before the damage packet that produced the finisher.
    ...(combo.priority == null ? {} : { priority: combo.priority }),
    at: combo.at,
    source: combo.source,
    sourceId: combo.sourceId,
    actorType: combo.actorType,
    skillId: combo.skillId,
    skillName: combo.skillName,
    parentSkillName: combo.parentSkillName,
    activationId: combo.activationId,
    triggeredBy: combo.skillName || combo.name || combo.source,
    comboId: combo.comboId,
    attemptId: combo.attemptId,
    fieldId: combo.fieldId,
    fieldType: combo.fieldType,
    fieldSourceId: combo.fieldSourceId,
    fieldSource: combo.fieldSource,
    fieldOwnerId: combo.fieldOwnerId,
    finisherType: combo.finisherType
  };
}

/** Converts one successful semantic combo into supported common events. */
export function materializeComboOutcome(combo: ComboEvent): readonly SimulationEventBase[] {
  const outcome = comboDefinition(combo.fieldType, combo.finisherType).outcome;
  const base = inheritedComboFields(combo);
  const one = (): SimulationEventBase | null => {
    switch (outcome.kind) {
      case 'aura':
        return {
          ...base,
          type: 'aura',
          name: outcome.name,
          aura: outcome.aura,
          duration: outcome.duration
        };
      case 'boon':
        return {
          ...base,
          type: 'buff',
          name: outcome.name,
          kind: outcome.boon.toLowerCase(),
          stacks: outcome.stacks,
          duration: outcome.duration,
          // Area combo boons use normal party targeting so an active companion
          // can claim an open target slot after players.
          ...(outcome.name.startsWith('Area ')
            ? {
                audience: {
                  recipients: RECIPIENT.PARTY,
                  maximumRecipients: 5,
                  eligibleCompanionIds: combo.companionCandidates
                }
              }
            : { audience: { recipients: RECIPIENT.PARTY } })
        };
      case 'condition':
        return {
          ...base,
          type: 'condition',
          name: outcome.name,
          condition: outcome.condition,
          stacks: outcome.stacks,
          duration: outcome.duration
        };
      case 'control':
        return {
          ...base,
          type: 'control',
          name: outcome.name,
          controlKind: outcome.control
        };
      case 'life-steal':
        return {
          ...base,
          type: 'damage',
          name: outcome.name,
          // Explicit outcome artwork prevents result rows from inheriting the triggering finisher's icon.
          icon: outcome.icon,
          // Siphon packets own their hits; keep the triggering finisher only as their parent.
          skillName: outcome.name,
          damageBreakdownName: outcome.name,
          parentSkillName: combo.skillName || combo.parentSkillName,
          coefficient: 0,
          flatStrikeBase: outcome.flatStrikeBase,
          flatStrikePowerCoeff: outcome.flatStrikePowerCoeff,
          canCrit: false,
          damageKind: 'life-steal'
        };
      case STATUS.STEALTH:
        return {
          ...base,
          type: 'buff',
          name: outcome.name,
          kind: STATUS.STEALTH,
          stacks: 1,
          duration: outcome.duration,
          audience: { recipients: RECIPIENT.PARTY },
          fixedDuration: true
        };
      case 'cleanse':
      case 'healing':
        return null;
    }
  };

  const applications = Math.max(1, combo.applicationCount);
  return Object.freeze(
    Array.from({ length: applications }, () => one()).filter((event): event is SimulationEventBase => event != null)
  );
}
