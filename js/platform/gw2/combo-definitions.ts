import type { SimulationEventInput, SkillId } from "../engine/types.js";
import type { ComboEvent, ComboFieldType, ComboFinisherType } from "./types.js";

export type ComboOutcome =
  | {
      readonly kind: "aura";
      readonly name: string;
      readonly aura: string;
      readonly duration: number;
    }
  | {
      readonly kind: "boon";
      readonly name: string;
      readonly boon: string;
      readonly stacks: number;
      readonly duration: number;
    }
  | {
      readonly kind: "condition";
      readonly name: string;
      readonly condition: string;
      readonly stacks: number;
      readonly duration: number;
    }
  | {
      readonly kind: "control";
      readonly name: string;
      readonly control: string;
      readonly duration: number;
    }
  | {
      readonly kind: "life-steal";
      readonly name: string;
      readonly flatStrikeBase: number;
      readonly flatStrikePowerCoeff: number;
      readonly ownsDamageAttribution?: boolean;
    }
  | {
      readonly kind: "cleanse";
      readonly name: string;
      readonly conditions: number;
    }
  | {
      readonly kind: "healing";
      readonly name: string;
      readonly flatHealing: number;
      readonly healingPowerCoefficient: number;
    }
  | {
      readonly kind: "stealth";
      readonly name: string;
      readonly duration: number;
    };

export interface ComboDefinition {
  readonly fieldType: ComboFieldType;
  readonly finisherType: ComboFinisherType;
  readonly outcome: ComboOutcome;
}

const aura = (name: string, duration: number): ComboOutcome =>
  Object.freeze({ kind: "aura", name, aura: name, duration });
const boon = (
  name: string,
  boonName: string,
  stacks: number,
  duration: number,
): ComboOutcome =>
  Object.freeze({ kind: "boon", name, boon: boonName, stacks, duration });
const condition = (
  name: string,
  conditionName: string,
  stacks: number,
  duration: number,
): ComboOutcome =>
  Object.freeze({
    kind: "condition",
    name,
    condition: conditionName,
    stacks,
    duration,
  });
const cleanse = (name: string): ComboOutcome =>
  Object.freeze({ kind: "cleanse", name, conditions: 1 });
const stealth = (name: string): ComboOutcome =>
  Object.freeze({ kind: "stealth", name, duration: 3 });
const healing = (
  name: string,
  flatHealing: number,
  healingPowerCoefficient: number,
): ComboOutcome =>
  Object.freeze({
    kind: "healing",
    name,
    flatHealing,
    healingPowerCoefficient,
  });
const lifeSteal = (
  name: string,
  flatStrikeBase: number,
  ownsDamageAttribution = false,
): ComboOutcome =>
  Object.freeze({
    kind: "life-steal",
    name,
    flatStrikeBase,
    flatStrikePowerCoeff: 0.03,
    ownsDamageAttribution,
  });

const definitions: readonly ComboDefinition[] = [
  { fieldType: "Dark", finisherType: "Blast", outcome: aura("Dark Aura", 3) },
  { fieldType: "Dark", finisherType: "Leap", outcome: aura("Dark Aura", 5) },
  {
    fieldType: "Dark",
    finisherType: "Projectile",
    outcome: lifeSteal("Life Stealing Projectile", 202),
  },
  {
    fieldType: "Dark",
    finisherType: "Whirl",
    outcome: lifeSteal("Leeching Bolts", 170, true),
  },
  {
    fieldType: "Ethereal",
    finisherType: "Blast",
    outcome: aura("Chaos Aura", 3),
  },
  {
    fieldType: "Ethereal",
    finisherType: "Leap",
    outcome: aura("Chaos Aura", 5),
  },
  {
    fieldType: "Ethereal",
    finisherType: "Projectile",
    outcome: condition("Confusion", "Confusion", 1, 5),
  },
  {
    fieldType: "Ethereal",
    finisherType: "Whirl",
    outcome: condition("Confounding Bolts", "Confusion", 1, 5),
  },
  {
    fieldType: "Fire",
    finisherType: "Blast",
    outcome: boon("Area Might", "Might", 3, 20),
  },
  { fieldType: "Fire", finisherType: "Leap", outcome: aura("Fire Aura", 5) },
  {
    fieldType: "Fire",
    finisherType: "Projectile",
    outcome: condition("Burning", "Burning", 1, 1),
  },
  {
    fieldType: "Fire",
    finisherType: "Whirl",
    outcome: condition("Burning Bolts", "Burning", 1, 1),
  },
  { fieldType: "Ice", finisherType: "Blast", outcome: aura("Frost Aura", 3) },
  { fieldType: "Ice", finisherType: "Leap", outcome: aura("Frost Aura", 5) },
  {
    fieldType: "Ice",
    finisherType: "Projectile",
    outcome: condition("Chilled", "Chilled", 1, 1),
  },
  {
    fieldType: "Ice",
    finisherType: "Whirl",
    outcome: condition("Chilling Bolts", "Chilled", 1, 1),
  },
  {
    fieldType: "Light",
    finisherType: "Blast",
    outcome: cleanse("Area Cleanse"),
  },
  { fieldType: "Light", finisherType: "Leap", outcome: aura("Light Aura", 5) },
  {
    fieldType: "Light",
    finisherType: "Projectile",
    outcome: cleanse("Cleanse"),
  },
  {
    fieldType: "Light",
    finisherType: "Whirl",
    outcome: cleanse("Cleansing Bolts"),
  },
  {
    fieldType: "Lightning",
    finisherType: "Blast",
    outcome: boon("Area Swiftness", "Swiftness", 1, 10),
  },
  {
    fieldType: "Lightning",
    finisherType: "Leap",
    outcome: Object.freeze({
      kind: "control",
      name: "Dazing Strike",
      control: "daze",
      duration: 1,
    }),
  },
  {
    fieldType: "Lightning",
    finisherType: "Projectile",
    outcome: condition("Vulnerability", "Vulnerability", 2, 5),
  },
  {
    fieldType: "Lightning",
    finisherType: "Whirl",
    outcome: condition("Brutal Bolts", "Vulnerability", 2, 5),
  },
  {
    fieldType: "Poison",
    finisherType: "Blast",
    outcome: condition("Area Weakness", "Weakness", 1, 3),
  },
  {
    fieldType: "Poison",
    finisherType: "Leap",
    outcome: condition("Weakness", "Weakness", 1, 8),
  },
  {
    fieldType: "Poison",
    finisherType: "Projectile",
    outcome: condition("Poisoned", "Poisoned", 1, 2),
  },
  {
    fieldType: "Poison",
    finisherType: "Whirl",
    outcome: condition("Poison Bolts", "Poisoned", 1, 2),
  },
  {
    fieldType: "Smoke",
    finisherType: "Blast",
    outcome: stealth("Area Stealth"),
  },
  { fieldType: "Smoke", finisherType: "Leap", outcome: stealth("Stealth") },
  {
    fieldType: "Smoke",
    finisherType: "Projectile",
    outcome: Object.freeze({
      kind: "condition",
      name: "Blindness",
      condition: "Blinded",
      stacks: 1,
      duration: 3,
    }),
  },
  {
    fieldType: "Smoke",
    finisherType: "Whirl",
    outcome: Object.freeze({
      kind: "condition",
      name: "Blinding Bolts",
      condition: "Blinded",
      stacks: 1,
      duration: 3,
    }),
  },
  {
    fieldType: "Water",
    finisherType: "Blast",
    outcome: healing("Area Healing", 1320, 0.2),
  },
  {
    fieldType: "Water",
    finisherType: "Leap",
    outcome: healing("Healing", 1300, 0.5),
  },
  {
    fieldType: "Water",
    finisherType: "Projectile",
    outcome: boon("Regeneration", "Regeneration", 1, 2),
  },
  {
    fieldType: "Water",
    finisherType: "Whirl",
    outcome: boon("Healing Bolts", "Regeneration", 1, 2),
  },
].map((definition) => Object.freeze(definition) as ComboDefinition);

const FIELD_TYPES: readonly ComboFieldType[] = [
  "Dark",
  "Ethereal",
  "Fire",
  "Ice",
  "Light",
  "Lightning",
  "Poison",
  "Smoke",
  "Water",
];
const FINISHER_TYPES: readonly ComboFinisherType[] = [
  "Blast",
  "Leap",
  "Projectile",
  "Whirl",
];

export function validateComboDefinitions(
  values: readonly ComboDefinition[],
): readonly ComboDefinition[] {
  const keys = new Set<string>();
  for (const definition of values) {
    const key = `${definition.fieldType}|${definition.finisherType}`;
    if (keys.has(key))
      throw new TypeError(`Duplicate combo definition: ${key}.`);
    keys.add(key);
    if (!definition.outcome?.kind || !definition.outcome.name) {
      throw new TypeError(`Combo definition ${key} requires an outcome.`);
    }
  }
  const expected = FIELD_TYPES.length * FINISHER_TYPES.length;
  if (values.length !== expected || keys.size !== expected) {
    throw new TypeError(
      `Combo definitions require all ${expected} field/finisher pairs.`,
    );
  }
  for (const fieldType of FIELD_TYPES) {
    for (const finisherType of FINISHER_TYPES) {
      const key = `${fieldType}|${finisherType}`;
      if (!keys.has(key))
        throw new TypeError(`Missing combo definition: ${key}.`);
    }
  }
  return values;
}

export const COMBO_DEFINITIONS = Object.freeze([
  ...validateComboDefinitions(definitions),
]);

const DEFINITION_BY_KEY = new Map(
  COMBO_DEFINITIONS.map((definition) => [
    `${definition.fieldType}|${definition.finisherType}`,
    definition,
  ]),
);

export function comboDefinition(
  fieldType: ComboFieldType,
  finisherType: ComboFinisherType,
): ComboDefinition {
  const definition = DEFINITION_BY_KEY.get(`${fieldType}|${finisherType}`);
  if (!definition) {
    throw new TypeError(
      `Missing combo definition: ${fieldType}/${finisherType}.`,
    );
  }
  return definition;
}

interface ComboOutcomeEventBase extends Record<string, unknown> {
  readonly at: number;
  readonly source: string;
  readonly sourceId: SkillId;
}

function inheritedComboFields(combo: ComboEvent): ComboOutcomeEventBase {
  return {
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
    finisherType: combo.finisherType,
    schedulerPrediction: combo.schedulerPrediction,
  };
}

/** Converts one successful semantic combo into supported common events. */
export function materializeComboOutcome(
  combo: ComboEvent,
): readonly SimulationEventInput[] {
  const outcome = comboDefinition(combo.fieldType, combo.finisherType).outcome;
  const base = inheritedComboFields(combo);
  const one = (): SimulationEventInput | null => {
    switch (outcome.kind) {
      case "aura":
        return {
          ...base,
          type: "aura",
          name: outcome.name,
          aura: outcome.aura,
          duration: outcome.duration,
        };
      case "boon":
        return {
          ...base,
          type: "buff",
          name: outcome.name,
          kind: outcome.boon.toLowerCase(),
          stacks: outcome.stacks,
          duration: outcome.duration,
          affectsSelf: true,
        };
      case "condition":
        return {
          ...base,
          type: "condition",
          name: outcome.name,
          condition: outcome.condition,
          stacks: outcome.stacks,
          duration: outcome.duration,
        };
      case "control":
        return {
          ...base,
          type: "control",
          name: outcome.name,
          controlKind: outcome.control,
          duration: outcome.duration,
        };
      case "life-steal":
        return {
          ...base,
          type: "damage",
          name: outcome.name,
          ...(outcome.ownsDamageAttribution
            ? {
                skillName: outcome.name,
                parentSkillName: combo.skillName || combo.parentSkillName,
              }
            : {}),
          coefficient: 0,
          flatStrikeBase: outcome.flatStrikeBase,
          flatStrikePowerCoeff: outcome.flatStrikePowerCoeff,
          noCrit: true,
          lifeSiphon: true,
        };
      case "stealth":
        return {
          ...base,
          type: "buff",
          name: outcome.name,
          kind: "stealth",
          stacks: 1,
          duration: outcome.duration,
          affectsSelf: true,
          fixedDuration: true,
        };
      case "cleanse":
      case "healing":
        return null;
    }
  };
  const applications = Math.max(1, combo.applicationCount);
  return Object.freeze(
    Array.from({ length: applications }, () => one()).filter(
      (event): event is SimulationEventInput => event != null,
    ),
  );
}
