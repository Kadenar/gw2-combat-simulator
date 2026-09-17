/**
 * Typed configuration for the gw2combat-derived engine and its JSON validation.
 *
 * Shapes, enum spellings, and defaults follow the pinned upstream
 * `src/configuration/*.hpp` so frozen reference builds load unchanged. Unlike
 * upstream's nlohmann readers, validation is strict: an unknown key, an unknown
 * enum spelling, or a fractional integer is reported with its JSON path instead
 * of silently becoming a default, because a dropped mechanic would still produce
 * a plausible score. `NOTE` keys are accepted as authoring comments.
 */

export const ATTRIBUTES = [
  'power',
  'precision',
  'toughness',
  'vitality',
  'concentration',
  'condition_damage',
  'expertise',
  'ferocity',
  'healing_power',
  'armor',
  'max_health',
  'critical_chance_multiplier',
  'critical_damage_multiplier',
  'boon_duration_multiplier',
  'aegis_duration_multiplier',
  'alacrity_duration_multiplier',
  'fury_duration_multiplier',
  'might_duration_multiplier',
  'protection_duration_multiplier',
  'quickness_duration_multiplier',
  'regeneration_duration_multiplier',
  'resistance_duration_multiplier',
  'resolution_duration_multiplier',
  'stability_duration_multiplier',
  'swiftness_duration_multiplier',
  'vigor_duration_multiplier',
  'condition_duration_multiplier',
  'burning_duration_multiplier',
  'bleeding_duration_multiplier',
  'confusion_duration_multiplier',
  'poison_duration_multiplier',
  'torment_duration_multiplier',
  'condition_damage_multiplier',
  'burning_damage_multiplier',
  'bleeding_damage_multiplier',
  'confusion_damage_multiplier',
  'poison_damage_multiplier',
  'torment_damage_multiplier',
  'outgoing_strike_damage_multiplier',
  'outgoing_strike_damage_multiplier_add_group',
  'incoming_strike_damage_multiplier',
  'incoming_strike_damage_multiplier_add_group',
  'outgoing_condition_damage_multiplier',
  'outgoing_condition_damage_multiplier_add_group',
  'incoming_condition_damage_multiplier',
  'incoming_condition_damage_multiplier_add_group'
] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const EFFECTS = [
  'AEGIS',
  'ALACRITY',
  'FURY',
  'MIGHT',
  'QUICKNESS',
  'RESOLUTION',
  'RESISTANCE',
  'PROTECTION',
  'REGENERATION',
  'VIGOR',
  'SWIFTNESS',
  'STABILITY',
  'BLINDED',
  'CHILLED',
  'CRIPPLED',
  'FEAR',
  'IMMOBILIZED',
  'SLOW',
  'TAUNT',
  'WEAKNESS',
  'VULNERABILITY',
  'BURNING',
  'BLEEDING',
  'TORMENT',
  'POISON',
  'CONFUSION',
  'BINDING_BLADE'
] as const;
export type Effect = (typeof EFFECTS)[number];

export const WEAPON_TYPES = [
  'main_hand',
  'empty_handed',
  'greatsword',
  'longbow',
  'sword',
  'axe',
  'torch',
  'scepter',
  'focus',
  'kit_conjure',
  'tome',
  'dagger',
  'mace',
  'pistol',
  'shield',
  'warhorn',
  'hammer',
  'rifle',
  'shortbow',
  'staff',
  'aquatic',
  'spear'
] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

export const WEAPON_POSITIONS = ['universal', 'main_hand', 'off_hand', 'two_handed'] as const;
export type WeaponPosition = (typeof WEAPON_POSITIONS)[number];

export const WEAPON_SETS = ['set_1', 'set_2'] as const;
export type WeaponSet = (typeof WEAPON_SETS)[number];

export type Stacking = 'intensity' | 'duration' | 'replace';
export type Direction = 'SELF' | 'TEAM' | 'OUTGOING';
export type ModifierOperation = 'ADD' | 'SUBTRACT' | 'SET' | 'RESET';
export type ThresholdType =
  'equal' | 'upper_bound_exclusive' | 'upper_bound_inclusive' | 'lower_bound_exclusive' | 'lower_bound_inclusive';
export type ComboField = 'dark' | 'ethereal' | 'fire' | 'ice' | 'light' | 'lightning' | 'poison' | 'smoke' | 'water';
export type WeaponStrengthMode = 'MEAN' | 'RANDOM' | 'LOWEST' | 'HIGHEST';
export type CriticalStrikeMode = 'MEAN' | 'RANDOM';
export type AuditType =
  | 'ACTOR_CREATED'
  | 'SKILL_CASTS'
  | 'BUNDLES'
  | 'EFFECT_APPLICATIONS'
  | 'DAMAGE'
  | 'COMBAT_STATS'
  | 'EFFECT_EXPIRATION'
  | 'ACTOR_DOWNSTATE';

/** Paired values indexed [without quickness/alacrity, with quickness/alacrity]. */
export type Pair = readonly [number, number];

export interface Threshold {
  readonly thresholdType: ThresholdType;
  readonly thresholdValue: number;
  readonly generateRandomNumberSubjectToThreshold?: boolean;
  readonly healthPctSubjectToThreshold?: boolean;
  readonly targetHealthPctSubjectToThreshold?: boolean;
  readonly counterValueSubjectToThreshold?: string;
}

/** Upstream `condition_t`. Absent optionals are unconstrained; stage flags gate hook evaluation. */
export interface Condition {
  readonly weaponType?: WeaponType;
  readonly weaponPosition?: WeaponPosition;
  readonly weaponSet?: WeaponSet;
  readonly bundle?: string;
  readonly uniqueEffectOnSource?: string;
  readonly effectOnSource?: Effect;
  readonly uniqueEffectOnTarget?: string;
  readonly uniqueEffectOnTargetBySource?: string;
  readonly effectOnTarget?: Effect;
  readonly stacksOfEffectOnTarget?: number;
  readonly dependsOnSkillOffCooldown?: string;
  readonly threshold?: Threshold;
  readonly not: readonly Condition[];
  readonly or: readonly Condition[];
  readonly and: readonly Condition[];
  readonly onlyAppliesOnStrikes?: boolean;
  readonly onlyAppliesOnCriticalStrikes?: boolean;
  readonly onlyAppliesOnStrikesBySkill?: string;
  readonly onlyAppliesOnStrikesBySkillWithTag?: string;
  readonly onlyAppliesOnEffectApplication?: boolean;
  readonly onlyAppliesOnEffectApplicationOfType?: Effect;
  readonly onlyAppliesOnBegunCasting?: boolean;
  readonly onlyAppliesOnBegunCastingSkill?: string;
  readonly onlyAppliesOnBegunCastingSkillWithTag?: string;
  readonly onlyAppliesOnFinishedCasting?: boolean;
  readonly onlyAppliesOnFinishedCastingSkill?: string;
  readonly onlyAppliesOnFinishedCastingSkillWithTag?: string;
  readonly onlyAppliesOnAmmoGainOfSkill?: string;
}

export interface AttributeModifier {
  readonly condition: Condition;
  readonly attribute: Attribute;
  readonly multiplier: number;
  readonly addend: number;
}

export interface AttributeConversion {
  readonly condition: Condition;
  readonly from: Attribute;
  readonly to: Attribute;
  readonly multiplier: number;
  readonly addend: number;
}

export interface CounterModifier {
  readonly condition: Condition;
  readonly counterKey: string;
  readonly operation: ModifierOperation;
  readonly value?: number;
  readonly counterValue?: string;
}

export interface CounterConfiguration {
  readonly counterKey: string;
  readonly initialValue: number;
  readonly counterModifiers: readonly CounterModifier[];
}

export interface CooldownModifier {
  readonly condition: Condition;
  readonly skillKey: string;
  readonly operation: ModifierOperation;
  readonly value: number;
}

export interface SkillTrigger {
  readonly condition: Condition;
  readonly skillKey: string;
}

export interface EffectRemoval {
  readonly condition: Condition;
  readonly effect: Effect | null;
  readonly uniqueEffect: string;
  readonly numStacks?: number;
}

/** Side effects shared by skills, skill ticks, and unique effects. */
export interface SideEffects {
  readonly attributeModifiers: readonly AttributeModifier[];
  readonly attributeConversions: readonly AttributeConversion[];
  readonly counterModifiers: readonly CounterModifier[];
  readonly skillTriggers: readonly SkillTrigger[];
  readonly unchainedSkillTriggers: readonly SkillTrigger[];
  readonly sourceActorSkillTriggers: readonly SkillTrigger[];
  readonly effectRemovals: readonly EffectRemoval[];
  readonly cooldownModifiers: readonly CooldownModifier[];
}

export interface UniqueEffect extends SideEffects {
  /** An empty key marks "no unique effect" exactly as upstream's `is_invalid()`. */
  readonly uniqueEffectKey: string;
  readonly maxConsideredStacks: number;
  readonly maxStoredStacks: number;
  readonly maxDuration: number;
  readonly stackingType: Stacking;
  readonly refreshesOtherStacks: boolean;
}

export interface EffectApplication {
  readonly condition: Condition;
  readonly effect: Effect | null;
  readonly uniqueEffect: UniqueEffect;
  readonly direction: Direction | null;
  readonly baseDurationMs: number;
  readonly numStacks: number;
  readonly numTargets: number;
}

export interface SkillTick extends SideEffects {
  readonly onTick: number;
  readonly numTargets: number;
  readonly attributeDamageToSkill: string;
  readonly flatDamage: number;
  readonly weaponType: WeaponType | null;
  readonly weaponStrengthRollGroup: number;
  readonly damageCoefficient: number;
  readonly pulse: boolean;
  readonly strike: boolean;
  readonly canCriticalStrike: boolean;
  readonly whirlFinisher: boolean;
  readonly onStrikeEffectApplications: readonly EffectApplication[];
  readonly onPulseEffectApplications: readonly EffectApplication[];
  readonly skillsToPutOnCooldown: readonly string[];
  readonly skillsToCancel: readonly string[];
  readonly childSkillKeys: readonly string[];
  readonly tags: readonly string[];
  readonly inheritTags: boolean;
  readonly tickCondition: Condition;
}

export interface Skill extends SideEffects {
  readonly skillKey: string;
  /** Sorted stably by `onTick` when prepared, matching `add_skill_to_actor`. */
  readonly skillTicks: readonly SkillTick[];
  readonly weaponType: WeaponType | null;
  readonly requiredBundle: string;
  readonly attributeDamageToSkill: string;
  readonly castDuration: Pair;
  readonly cooldown: Pair;
  readonly flatDamage: number;
  readonly damageCoefficient: number;
  readonly ammo: number;
  readonly rechargeDuration: number;
  readonly numTargets: number;
  readonly strikeOnTickList: readonly [readonly number[], readonly number[]];
  readonly pulseOnTickList: readonly [readonly number[], readonly number[]];
  readonly onStrikeEffectApplications: readonly EffectApplication[];
  readonly onPulseEffectApplications: readonly EffectApplication[];
  readonly skillsToPutOnCooldown: readonly string[];
  readonly skillsToCancel: readonly string[];
  readonly childSkillKeys: readonly string[];
  readonly tags: readonly string[];
  readonly comboField: ComboField | null;
  readonly whirlFinisherOnTickList: readonly [readonly number[], readonly number[]];
  readonly instantCastOnlyWhenNotInAnimation: boolean;
  readonly canCriticalStrike: boolean;
  readonly equipBundle: string;
  readonly dropBundle: string;
  readonly executable: boolean;
  readonly castCondition: Condition;
  /**
   * Swaps weapon sets on completion, or only drops an equipped bundle. While a
   * bundle is held the skill may be cast without ammo and does not recharge.
   */
  readonly weaponSwap: boolean;
  /** Strikes still deal damage but fire no on-strike side effects or on-strike effect applications. */
  readonly skipOnStrikeHooks: boolean;
}

/** Skill spawned when a whirl finisher is used inside the longest-running combo field of a given type. */
export interface WhirlFinisherSkill {
  readonly comboField: ComboField;
  readonly skillKey: string;
}

export interface ConditionalSkillGroup {
  readonly skillKey: string;
  readonly conditionalSkillKeys: readonly { readonly condition: Condition; readonly skillKey: string }[];
}

export interface Weapon {
  readonly type: WeaponType | null;
  readonly position: WeaponPosition | null;
  readonly set: WeaponSet | null;
}

export interface Recipe {
  readonly counters: readonly CounterConfiguration[];
  readonly permanentEffects: readonly Effect[];
  readonly permanentUniqueEffects: readonly UniqueEffect[];
  readonly skills: readonly Skill[];
  readonly conditionalSkillGroups: readonly ConditionalSkillGroup[];
  readonly whirlFinisherSkills: readonly WhirlFinisherSkill[];
}

export interface Build extends Recipe {
  readonly baseClass: string;
  readonly profession: string;
  readonly attributes: ReadonlyMap<Attribute, number>;
  readonly weapons: readonly Weapon[];
  readonly initialWeaponSet: WeaponSet | null;
  readonly recipes: readonly Recipe[];
}

export interface SkillCast {
  readonly skill: string;
  readonly castTimeMs: number;
}

export interface Rotation {
  readonly skillCasts: readonly SkillCast[];
  readonly repeat: boolean;
}

export interface EncounterActor {
  readonly name: string;
  readonly build: Build;
  readonly rotation: Rotation;
  readonly team: number;
}

export type TerminationCondition =
  | { readonly type: 'TIME'; readonly time: number }
  | { readonly type: 'ROTATION'; readonly actor: string }
  | { readonly type: 'ACTIVE_SKILLS'; readonly actor: string }
  | { readonly type: 'DAMAGE'; readonly actor: string; readonly damage: number };

export interface Encounter {
  readonly actors: readonly EncounterActor[];
  readonly terminationConditions: readonly TerminationCondition[];
  readonly auditsToPerform: ReadonlySet<AuditType>;
  readonly requireAfkSkills: boolean;
  readonly conditionTickOffset: number;
  readonly weaponStrengthMode: WeaponStrengthMode;
  readonly criticalStrikeMode: CriticalStrikeMode;
}

export class ConfigurationError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, path: string, message: string) {
    super(`${path}: ${message}`);
    this.code = code;
    this.path = path;
  }
}

type JsonObject = Readonly<Record<string, unknown>>;

/** Keys that document content without affecting simulation. */
const ANNOTATION_KEYS = new Set(['NOTE']);

/**
 * Reads one JSON object field by field and fails on anything left unread, so a
 * misspelled or unsupported mechanic cannot vanish during conversion.
 */
class ObjectReader {
  private readonly consumed = new Set<string>(ANNOTATION_KEYS);

  constructor(
    private readonly source: JsonObject,
    readonly path: string
  ) {}

  static of(value: unknown, path: string): ObjectReader {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      throw new ConfigurationError('configuration.expected-object', path, 'expected an object.');
    }

    return new ObjectReader(value as JsonObject, path);
  }

  has(key: string): boolean {
    return Object.hasOwn(this.source, key);
  }

  raw(key: string): unknown {
    this.consumed.add(key);
    return this.source[key];
  }

  child(key: string): string {
    return `${this.path}.${key}`;
  }

  string(key: string, fallback = ''): string {
    if (!this.has(key)) return fallback;
    const value = this.raw(key);
    if (typeof value !== 'string') {
      throw new ConfigurationError('configuration.expected-string', this.child(key), 'expected a string.');
    }

    return value;
  }

  optionalString(key: string): string | undefined {
    return this.has(key) ? this.string(key) : undefined;
  }

  number(key: string, fallback: number): number {
    if (!this.has(key)) return fallback;
    return readNumber(this.raw(key), this.child(key));
  }

  integer(key: string, fallback: number): number {
    if (!this.has(key)) return fallback;
    return readInteger(this.raw(key), this.child(key));
  }

  optionalInteger(key: string): number | undefined {
    return this.has(key) ? this.integer(key, 0) : undefined;
  }

  boolean(key: string, fallback: boolean): boolean {
    if (!this.has(key)) return fallback;
    const value = this.raw(key);
    if (typeof value !== 'boolean') {
      throw new ConfigurationError('configuration.expected-boolean', this.child(key), 'expected a boolean.');
    }

    return value;
  }

  optionalBoolean(key: string): boolean | undefined {
    return this.has(key) ? this.boolean(key, false) : undefined;
  }

  enumValue<T extends string>(key: string, spellings: ReadonlyMap<string, T | null>, fallback: T | null): T | null {
    if (!this.has(key)) return fallback;
    return readEnum(this.raw(key), spellings, this.child(key));
  }

  array<T>(key: string, readItem: (value: unknown, path: string) => T): T[] {
    if (!this.has(key)) return [];
    const value = this.raw(key);
    if (!Array.isArray(value)) {
      throw new ConfigurationError('configuration.expected-array', this.child(key), 'expected an array.');
    }

    return value.map((item, index) => readItem(item, `${this.child(key)}[${index}]`));
  }

  /** Rejects any key the reader did not consume. */
  done(): void {
    for (const key of Object.keys(this.source)) {
      if (this.consumed.has(key)) continue;
      throw new ConfigurationError(
        'configuration.unsupported-key',
        this.child(key),
        'is not a supported gw2combat configuration key.'
      );
    }
  }
}

function readNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ConfigurationError('configuration.expected-number', path, 'expected a finite number.');
  }

  return value;
}

function readInteger(value: unknown, path: string): number {
  const numeric = readNumber(value, path);
  if (!Number.isSafeInteger(numeric)) {
    throw new ConfigurationError('configuration.expected-integer', path, 'expected an integer.');
  }

  return numeric;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new ConfigurationError('configuration.expected-string', path, 'expected a string.');
  }

  return value;
}

function readEnum<T extends string>(value: unknown, spellings: ReadonlyMap<string, T | null>, path: string): T | null {
  const text = readString(value, path);
  if (!spellings.has(text)) {
    throw new ConfigurationError('configuration.unknown-enum', path, `"${text}" is not a recognized value.`);
  }

  return spellings.get(text) ?? null;
}

/** Builds an upstream enum table where "invalid" deserializes to the absent value. */
function spellingTable<T extends string>(
  values: readonly T[],
  aliases: Readonly<Record<string, T>> = {}
): ReadonlyMap<string, T | null> {
  const table = new Map<string, T | null>([['invalid', null]]);
  for (const value of values) table.set(value, value);
  for (const [alias, value] of Object.entries(aliases)) table.set(alias, value);
  return table;
}

function requireValue<T>(value: T | null, path: string, label: string): T {
  if (value == null) {
    throw new ConfigurationError('configuration.invalid-enum', path, `${label} must not be "invalid".`);
  }

  return value;
}

const ATTRIBUTE_TABLE = spellingTable(ATTRIBUTES);
const EFFECT_TABLE = spellingTable(EFFECTS);
const WEAPON_TYPE_TABLE = spellingTable(WEAPON_TYPES);
const WEAPON_POSITION_TABLE = spellingTable(WEAPON_POSITIONS);
const WEAPON_SET_TABLE = spellingTable(WEAPON_SETS);
const DIRECTION_TABLE = spellingTable<Direction>(['SELF', 'TEAM', 'OUTGOING']);
const STACKING_TABLE = spellingTable<Stacking>(['replace'], {
  stacking_intensity: 'intensity',
  intensity: 'intensity',
  stacking_duration: 'duration',
  duration: 'duration'
});
const OPERATION_TABLE = spellingTable<ModifierOperation>(['ADD', 'SUBTRACT', 'SET', 'RESET'], {
  add: 'ADD',
  subtract: 'SUBTRACT',
  set: 'SET',
  reset: 'RESET'
});
const THRESHOLD_TABLE = spellingTable<ThresholdType>([
  'equal',
  'upper_bound_exclusive',
  'upper_bound_inclusive',
  'lower_bound_exclusive',
  'lower_bound_inclusive'
]);
const COMBO_FIELDS: readonly ComboField[] = [
  'dark',
  'ethereal',
  'fire',
  'ice',
  'light',
  'lightning',
  'poison',
  'smoke',
  'water'
];
const COMBO_FIELD_TABLE = spellingTable<ComboField>(
  COMBO_FIELDS,
  Object.fromEntries(COMBO_FIELDS.map((field) => [field.toUpperCase(), field]))
);
const BASE_CLASS_TABLE = spellingTable(['UNIVERSAL', 'GUARDIAN', 'RANGER'], {
  universal: 'UNIVERSAL',
  guardian: 'GUARDIAN',
  ranger: 'RANGER'
});
const PROFESSION_TABLE = spellingTable(['dragonhunter', 'soulbeast']);
const TERMINATION_TABLE = spellingTable(['TIME', 'ROTATION', 'DAMAGE', 'ACTIVE_SKILLS']);
const WEAPON_STRENGTH_TABLE = spellingTable<WeaponStrengthMode>(['MEAN', 'RANDOM', 'LOWEST', 'HIGHEST']);
const CRITICAL_STRIKE_TABLE = spellingTable<CriticalStrikeMode>(['MEAN', 'RANDOM']);
const AUDIT_TABLE = spellingTable<AuditType>([
  'ACTOR_CREATED',
  'SKILL_CASTS',
  'BUNDLES',
  'EFFECT_APPLICATIONS',
  'DAMAGE',
  'COMBAT_STATS',
  'EFFECT_EXPIRATION',
  'ACTOR_DOWNSTATE'
]);

export const EMPTY_CONDITION: Condition = Object.freeze({ not: [], or: [], and: [] });

function readThreshold(value: unknown, path: string): Threshold {
  const reader = ObjectReader.of(value, path);
  const threshold: Threshold = {
    thresholdType: requireValue(
      reader.enumValue('threshold_type', THRESHOLD_TABLE, null),
      reader.child('threshold_type'),
      'threshold_type'
    ),
    thresholdValue: reader.number('threshold_value', 0),
    generateRandomNumberSubjectToThreshold: reader.optionalBoolean('generate_random_number_subject_to_threshold'),
    healthPctSubjectToThreshold: reader.optionalBoolean('health_pct_subject_to_threshold'),
    targetHealthPctSubjectToThreshold: reader.optionalBoolean('target_health_pct_subject_to_threshold'),
    counterValueSubjectToThreshold: reader.optionalString('counter_value_subject_to_threshold')
  };
  reader.done();
  return threshold;
}

function optionalEnum<T extends string>(
  reader: ObjectReader,
  key: string,
  table: ReadonlyMap<string, T | null>
): T | undefined {
  if (!reader.has(key)) return undefined;
  return requireValue(reader.enumValue(key, table, null), reader.child(key), key);
}

export function readCondition(value: unknown, path: string): Condition {
  const reader = ObjectReader.of(value, path);
  const condition: Condition = {
    weaponType: optionalEnum(reader, 'weapon_type', WEAPON_TYPE_TABLE),
    weaponPosition: optionalEnum(reader, 'weapon_position', WEAPON_POSITION_TABLE),
    weaponSet: optionalEnum(reader, 'weapon_set', WEAPON_SET_TABLE),
    bundle: reader.optionalString('bundle'),
    uniqueEffectOnSource: reader.optionalString('unique_effect_on_source'),
    effectOnSource: optionalEnum(reader, 'effect_on_source', EFFECT_TABLE),
    uniqueEffectOnTarget: reader.optionalString('unique_effect_on_target'),
    uniqueEffectOnTargetBySource: reader.optionalString('unique_effect_on_target_by_source'),
    effectOnTarget: optionalEnum(reader, 'effect_on_target', EFFECT_TABLE),
    stacksOfEffectOnTarget: reader.optionalInteger('stacks_of_effect_on_target'),
    dependsOnSkillOffCooldown: reader.optionalString('depends_on_skill_off_cooldown'),
    threshold: reader.has('threshold') ? readThreshold(reader.raw('threshold'), reader.child('threshold')) : undefined,
    not: reader.array('not', readCondition),
    or: reader.array('or', readCondition),
    and: reader.array('and', readCondition),
    onlyAppliesOnStrikes: reader.optionalBoolean('only_applies_on_strikes'),
    onlyAppliesOnCriticalStrikes: reader.optionalBoolean('only_applies_on_critical_strikes'),
    onlyAppliesOnStrikesBySkill: reader.optionalString('only_applies_on_strikes_by_skill'),
    onlyAppliesOnStrikesBySkillWithTag: reader.optionalString('only_applies_on_strikes_by_skill_with_tag'),
    onlyAppliesOnEffectApplication: reader.optionalBoolean('only_applies_on_effect_application'),
    onlyAppliesOnEffectApplicationOfType: optionalEnum(
      reader,
      'only_applies_on_effect_application_of_type',
      EFFECT_TABLE
    ),
    onlyAppliesOnBegunCasting: reader.optionalBoolean('only_applies_on_begun_casting'),
    onlyAppliesOnBegunCastingSkill: reader.optionalString('only_applies_on_begun_casting_skill'),
    onlyAppliesOnBegunCastingSkillWithTag: reader.optionalString('only_applies_on_begun_casting_skill_with_tag'),
    onlyAppliesOnFinishedCasting: reader.optionalBoolean('only_applies_on_finished_casting'),
    onlyAppliesOnFinishedCastingSkill: reader.optionalString('only_applies_on_finished_casting_skill'),
    onlyAppliesOnFinishedCastingSkillWithTag: reader.optionalString('only_applies_on_finished_casting_skill_with_tag'),
    onlyAppliesOnAmmoGainOfSkill: reader.optionalString('only_applies_on_ammo_gain_of_skill')
  };
  reader.done();
  return condition;
}

function readOptionalCondition(reader: ObjectReader, key: string): Condition {
  return reader.has(key) ? readCondition(reader.raw(key), reader.child(key)) : EMPTY_CONDITION;
}

function readAttributeModifier(value: unknown, path: string): AttributeModifier {
  const reader = ObjectReader.of(value, path);
  const modifier: AttributeModifier = {
    condition: readOptionalCondition(reader, 'condition'),
    attribute: requireValue(
      reader.enumValue('attribute', ATTRIBUTE_TABLE, null),
      reader.child('attribute'),
      'attribute'
    ),
    multiplier: reader.number('multiplier', 1),
    addend: reader.number('addend', 0)
  };
  reader.done();
  return modifier;
}

function readAttributeConversion(value: unknown, path: string): AttributeConversion {
  const reader = ObjectReader.of(value, path);
  const conversion: AttributeConversion = {
    condition: readOptionalCondition(reader, 'condition'),
    from: requireValue(reader.enumValue('from', ATTRIBUTE_TABLE, null), reader.child('from'), 'from'),
    to: requireValue(reader.enumValue('to', ATTRIBUTE_TABLE, null), reader.child('to'), 'to'),
    multiplier: reader.number('multiplier', 1),
    addend: reader.number('addend', 0)
  };
  reader.done();
  return conversion;
}

function readCounterModifier(value: unknown, path: string): CounterModifier {
  const reader = ObjectReader.of(value, path);
  const modifier: CounterModifier = {
    condition: readOptionalCondition(reader, 'condition'),
    counterKey: reader.string('counter_key'),
    operation: requireValue(
      reader.enumValue('operation', OPERATION_TABLE, 'ADD'),
      reader.child('operation'),
      'operation'
    ),
    value: reader.optionalInteger('value'),
    counterValue: reader.optionalString('counter_value')
  };
  reader.done();
  return modifier;
}

function readCounterConfiguration(value: unknown, path: string): CounterConfiguration {
  const reader = ObjectReader.of(value, path);
  const counter: CounterConfiguration = {
    counterKey: reader.string('counter_key'),
    initialValue: reader.integer('initial_value', 0),
    counterModifiers: reader.array('counter_modifiers', readCounterModifier)
  };
  reader.done();
  return counter;
}

function readCooldownModifier(value: unknown, path: string): CooldownModifier {
  const reader = ObjectReader.of(value, path);
  const modifier: CooldownModifier = {
    condition: readOptionalCondition(reader, 'condition'),
    skillKey: reader.string('skill_key'),
    operation: requireValue(
      reader.enumValue('operation', OPERATION_TABLE, 'ADD'),
      reader.child('operation'),
      'operation'
    ),
    value: reader.integer('value', 0)
  };
  reader.done();
  return modifier;
}

function readSkillTrigger(value: unknown, path: string): SkillTrigger {
  const reader = ObjectReader.of(value, path);
  const trigger: SkillTrigger = {
    condition: readOptionalCondition(reader, 'condition'),
    skillKey: reader.string('skill_key')
  };
  reader.done();
  return trigger;
}

function readEffectRemoval(value: unknown, path: string): EffectRemoval {
  const reader = ObjectReader.of(value, path);
  const removal: EffectRemoval = {
    condition: readOptionalCondition(reader, 'condition'),
    effect: reader.enumValue('effect', EFFECT_TABLE, null),
    uniqueEffect: reader.string('unique_effect'),
    numStacks: reader.optionalInteger('num_stacks')
  };
  reader.done();
  return removal;
}

/** Reads the side-effect lists every skill, skill tick, and unique effect may carry. */
function readSideEffects(reader: ObjectReader): SideEffects {
  return {
    attributeModifiers: reader.array('attribute_modifiers', readAttributeModifier),
    attributeConversions: reader.array('attribute_conversions', readAttributeConversion),
    counterModifiers: reader.array('counter_modifiers', readCounterModifier),
    skillTriggers: reader.array('skill_triggers', readSkillTrigger),
    unchainedSkillTriggers: reader.array('unchained_skill_triggers', readSkillTrigger),
    sourceActorSkillTriggers: reader.array('source_actor_skill_triggers', readSkillTrigger),
    effectRemovals: reader.array('effect_removals', readEffectRemoval),
    cooldownModifiers: reader.array('cooldown_modifiers', readCooldownModifier)
  };
}

export const EMPTY_UNIQUE_EFFECT: UniqueEffect = Object.freeze({
  uniqueEffectKey: '',
  attributeModifiers: [],
  attributeConversions: [],
  counterModifiers: [],
  skillTriggers: [],
  unchainedSkillTriggers: [],
  sourceActorSkillTriggers: [],
  effectRemovals: [],
  cooldownModifiers: [],
  maxConsideredStacks: 1,
  maxStoredStacks: 1500,
  maxDuration: 30_000,
  stackingType: 'intensity',
  refreshesOtherStacks: false
});

function readUniqueEffect(value: unknown, path: string): UniqueEffect {
  const reader = ObjectReader.of(value, path);
  const uniqueEffect: UniqueEffect = {
    uniqueEffectKey: reader.string('unique_effect_key'),
    ...readSideEffects(reader),
    maxConsideredStacks: reader.integer('max_considered_stacks', 1),
    maxStoredStacks: reader.integer('max_stored_stacks', 1500),
    maxDuration: reader.integer('max_duration', 30_000),
    stackingType: requireValue(
      reader.enumValue('stacking_type', STACKING_TABLE, 'intensity'),
      reader.child('stacking_type'),
      'stacking_type'
    ),
    refreshesOtherStacks: reader.boolean('refreshes_other_stacks', false)
  };
  reader.done();
  return uniqueEffect;
}

function readEffectApplication(value: unknown, path: string): EffectApplication {
  const reader = ObjectReader.of(value, path);
  const application: EffectApplication = {
    condition: readOptionalCondition(reader, 'condition'),
    effect: reader.enumValue('effect', EFFECT_TABLE, null),
    uniqueEffect: reader.has('unique_effect')
      ? readUniqueEffect(reader.raw('unique_effect'), reader.child('unique_effect'))
      : EMPTY_UNIQUE_EFFECT,
    direction: reader.enumValue('direction', DIRECTION_TABLE, null),
    baseDurationMs: reader.integer('base_duration_ms', 0),
    numStacks: reader.integer('num_stacks', 1),
    numTargets: reader.integer('num_targets', 1)
  };
  reader.done();
  return application;
}

function readStrings(reader: ObjectReader, key: string): string[] {
  return reader.array(key, readString);
}

function readPair(reader: ObjectReader, key: string): Pair {
  if (!reader.has(key)) return [0, 0];
  const value = reader.raw(key);
  if (!Array.isArray(value) || value.length !== 2) {
    throw new ConfigurationError('configuration.expected-pair', reader.child(key), 'expected a two-element array.');
  }

  return [readInteger(value[0], `${reader.child(key)}[0]`), readInteger(value[1], `${reader.child(key)}[1]`)];
}

function readTickListPair(reader: ObjectReader, key: string): readonly [readonly number[], readonly number[]] {
  if (!reader.has(key)) return [[], []];
  const value = reader.raw(key);
  if (!Array.isArray(value) || value.length !== 2) {
    throw new ConfigurationError('configuration.expected-pair', reader.child(key), 'expected a two-element array.');
  }

  return [0, 1].map((index) => {
    const list = value[index];
    const listPath = `${reader.child(key)}[${index}]`;
    if (!Array.isArray(list)) {
      throw new ConfigurationError('configuration.expected-array', listPath, 'expected an array.');
    }

    return list.map((tick, tickIndex) => readInteger(tick, `${listPath}[${tickIndex}]`));
  }) as unknown as readonly [readonly number[], readonly number[]];
}

function readSkillTick(value: unknown, path: string): SkillTick {
  const reader = ObjectReader.of(value, path);
  const tick: SkillTick = {
    onTick: reader.integer('on_tick', 0),
    numTargets: reader.integer('num_targets', 1),
    attributeDamageToSkill: reader.string('attribute_damage_to_skill'),
    flatDamage: reader.number('flat_damage', 0),
    weaponType: reader.enumValue('weapon_type', WEAPON_TYPE_TABLE, null),
    weaponStrengthRollGroup: reader.integer('weapon_strength_roll_group', 0),
    damageCoefficient: reader.number('damage_coefficient', 0),
    pulse: reader.boolean('pulse', false),
    strike: reader.boolean('strike', false),
    canCriticalStrike: reader.boolean('can_critical_strike', true),
    whirlFinisher: reader.boolean('whirl_finisher', false),
    onStrikeEffectApplications: reader.array('on_strike_effect_applications', readEffectApplication),
    onPulseEffectApplications: reader.array('on_pulse_effect_applications', readEffectApplication),
    ...readSideEffects(reader),
    skillsToPutOnCooldown: readStrings(reader, 'skills_to_put_on_cooldown'),
    skillsToCancel: readStrings(reader, 'skills_to_cancel'),
    childSkillKeys: readStrings(reader, 'child_skill_keys'),
    tags: readStrings(reader, 'tags'),
    inheritTags: reader.boolean('inherit_tags', true),
    tickCondition: readOptionalCondition(reader, 'tick_condition')
  };
  reader.done();
  return tick;
}

/**
 * Paired durations index progress by quickness/alacrity state. The reference
 * divides by the second entry whenever the first is non-zero, so a zero there
 * would fault the C++ build; it is rejected here instead.
 */
function validatePairDivisor(pair: Pair, path: string): void {
  if (pair[0] < 0 || pair[1] < 0) {
    throw new ConfigurationError('configuration.negative-duration', path, 'durations must be non-negative.');
  }

  if (pair[0] !== 0 && pair[1] === 0) {
    throw new ConfigurationError(
      'configuration.zero-accelerated-duration',
      path,
      'a non-zero duration requires a non-zero accelerated duration.'
    );
  }
}

export function readSkill(value: unknown, path: string): Skill {
  const reader = ObjectReader.of(value, path);
  const skillTicks = reader.array('skill_ticks', readSkillTick);
  const skill: Skill = {
    skillKey: reader.string('skill_key'),
    // Stable sort by on_tick so JSON order never changes execution, as upstream does on registration.
    skillTicks: skillTicks
      .map((tick, index) => ({ tick, index }))
      .sort((left, right) => left.tick.onTick - right.tick.onTick || left.index - right.index)
      .map(({ tick }) => tick),
    weaponType: reader.enumValue('weapon_type', WEAPON_TYPE_TABLE, null),
    requiredBundle: reader.string('required_bundle'),
    attributeDamageToSkill: reader.string('attribute_damage_to_skill'),
    castDuration: readPair(reader, 'cast_duration'),
    cooldown: readPair(reader, 'cooldown'),
    flatDamage: reader.number('flat_damage', 0),
    damageCoefficient: reader.number('damage_coefficient', 0),
    ammo: reader.integer('ammo', 1),
    rechargeDuration: reader.integer('recharge_duration', 0),
    numTargets: reader.integer('num_targets', 1),
    strikeOnTickList: readTickListPair(reader, 'strike_on_tick_list'),
    pulseOnTickList: readTickListPair(reader, 'pulse_on_tick_list'),
    onStrikeEffectApplications: reader.array('on_strike_effect_applications', readEffectApplication),
    onPulseEffectApplications: reader.array('on_pulse_effect_applications', readEffectApplication),
    ...readSideEffects(reader),
    skillsToPutOnCooldown: readStrings(reader, 'skills_to_put_on_cooldown'),
    skillsToCancel: readStrings(reader, 'skills_to_cancel'),
    childSkillKeys: readStrings(reader, 'child_skill_keys'),
    tags: readStrings(reader, 'tags'),
    comboField: reader.enumValue('combo_field', COMBO_FIELD_TABLE, null),
    whirlFinisherOnTickList: readTickListPair(reader, 'whirl_finisher_on_tick_list'),
    instantCastOnlyWhenNotInAnimation: reader.boolean('instant_cast_only_when_not_in_animation', false),
    canCriticalStrike: reader.boolean('can_critical_strike', true),
    equipBundle: reader.string('equip_bundle'),
    dropBundle: reader.string('drop_bundle'),
    executable: reader.boolean('executable', false),
    castCondition: readOptionalCondition(reader, 'cast_condition'),
    weaponSwap: reader.boolean('weapon_swap', false),
    skipOnStrikeHooks: reader.boolean('skip_on_strike_hooks', false)
  };
  reader.done();
  validatePairDivisor(skill.castDuration, reader.child('cast_duration'));
  validatePairDivisor(skill.cooldown, reader.child('cooldown'));
  return skill;
}

function readConditionalSkillGroup(value: unknown, path: string): ConditionalSkillGroup {
  const reader = ObjectReader.of(value, path);
  const group: ConditionalSkillGroup = {
    skillKey: reader.string('skill_key'),
    conditionalSkillKeys: reader.array('conditional_skill_keys', (item, itemPath) => {
      const itemReader = ObjectReader.of(item, itemPath);
      const entry = {
        condition: readOptionalCondition(itemReader, 'condition'),
        skillKey: itemReader.string('skill_key')
      };
      itemReader.done();
      return entry;
    })
  };
  reader.done();
  return group;
}

function readWeapon(value: unknown, path: string): Weapon {
  const reader = ObjectReader.of(value, path);
  const weapon: Weapon = {
    type: reader.enumValue('type', WEAPON_TYPE_TABLE, null),
    position: reader.enumValue('position', WEAPON_POSITION_TABLE, null),
    set: reader.enumValue('set', WEAPON_SET_TABLE, null)
  };
  reader.done();
  return weapon;
}

function readRecipeFields(reader: ObjectReader): Recipe {
  return {
    counters: reader.array('counters', readCounterConfiguration),
    permanentEffects: reader.array('permanent_effects', (value, path) =>
      requireValue(readEnum(value, EFFECT_TABLE, path), path, 'permanent effect')
    ),
    permanentUniqueEffects: reader.array('permanent_unique_effects', readUniqueEffect),
    skills: reader.array('skills', readSkill),
    conditionalSkillGroups: reader.array('conditional_skill_groups', readConditionalSkillGroup),
    whirlFinisherSkills: reader.array('whirl_finisher_skills', readWhirlFinisherSkill)
  };
}

function readWhirlFinisherSkill(value: unknown, path: string): WhirlFinisherSkill {
  const reader = ObjectReader.of(value, path);
  const entry: WhirlFinisherSkill = {
    comboField: requireValue(
      reader.enumValue('combo_field', COMBO_FIELD_TABLE, null),
      reader.child('combo_field'),
      'combo_field'
    ),
    skillKey: reader.string('skill_key')
  };
  reader.done();
  if (entry.skillKey === '') {
    throw new ConfigurationError(
      'configuration.missing-skill-key',
      reader.child('skill_key'),
      'skill_key is required.'
    );
  }

  return entry;
}

function readRecipe(value: unknown, path: string): Recipe {
  const reader = ObjectReader.of(value, path);
  const recipe = readRecipeFields(reader);
  reader.done();
  return recipe;
}

/** Upstream `build_t` attribute defaults; builds override individual entries. */
export const DEFAULT_ATTRIBUTES: ReadonlyMap<Attribute, number> = new Map<Attribute, number>([
  ...ATTRIBUTES.map((attribute): [Attribute, number] => [attribute, 0]),
  ['power', 1000],
  ['precision', 1000],
  ['toughness', 1000],
  ['vitality', 1000],
  ['armor', 1000],
  ['max_health', 1],
  ['critical_damage_multiplier', 1.5],
  ...ATTRIBUTES.filter(
    (attribute) =>
      attribute.endsWith('_duration_multiplier') ||
      (attribute.endsWith('_damage_multiplier') && attribute !== 'critical_damage_multiplier')
  ).map((attribute): [Attribute, number] => [attribute, 1]),
  ['critical_damage_multiplier', 1.5]
]);

/** Parses one upstream build JSON document. File-based `recipe_paths` must be resolved by the caller. */
export function readBuild(value: unknown, path = 'build'): Build {
  const reader = ObjectReader.of(value, path);
  const attributes = new Map(DEFAULT_ATTRIBUTES);
  const seen = new Set<Attribute>();
  for (const [index, entry] of reader.array('attributes', (item, itemPath) => [item, itemPath] as const).entries()) {
    const [item, itemPath] = entry;
    if (!Array.isArray(item) || item.length !== 2) {
      throw new ConfigurationError(
        'configuration.expected-pair',
        itemPath,
        `attribute entry ${index} must be an [attribute, value] pair.`
      );
    }

    const attribute = requireValue(readEnum(item[0], ATTRIBUTE_TABLE, `${itemPath}[0]`), itemPath, 'attribute');
    // Upstream silently keeps the first of duplicate pairs; an ambiguous build is rejected instead.
    if (seen.has(attribute)) {
      throw new ConfigurationError(
        'configuration.duplicate-attribute',
        itemPath,
        `attribute "${attribute}" is repeated.`
      );
    }

    seen.add(attribute);
    attributes.set(attribute, readNumber(item[1], `${itemPath}[1]`));
  }

  const recipePaths = readStrings(reader, 'recipe_paths');
  if (recipePaths.length > 0) {
    throw new ConfigurationError(
      'configuration.unresolved-recipe-path',
      reader.child('recipe_paths'),
      'recipe files must be loaded by the caller and supplied inline through "recipes".'
    );
  }

  const build: Build = {
    baseClass: reader.enumValue('base_class', BASE_CLASS_TABLE, null) ?? 'invalid',
    profession: reader.enumValue('profession', PROFESSION_TABLE, null) ?? 'invalid',
    attributes,
    weapons: reader.array('weapons', readWeapon),
    initialWeaponSet: reader.enumValue('initial_weapon_set', WEAPON_SET_TABLE, 'set_1'),
    recipes: reader.array('recipes', readRecipe),
    ...readRecipeFields(reader)
  };
  reader.done();

  // A combo field may map to one whirl skill per actor, across the build and its recipes.
  const whirlFields = new Set<ComboField>();
  for (const entry of [...build.recipes, build].flatMap((recipe) => recipe.whirlFinisherSkills)) {
    if (whirlFields.has(entry.comboField)) {
      throw new ConfigurationError(
        'configuration.duplicate-whirl-finisher',
        reader.child('whirl_finisher_skills'),
        `combo field "${entry.comboField}" maps to more than one whirl finisher skill.`
      );
    }

    whirlFields.add(entry.comboField);
  }

  return build;
}

/** Parses the upstream JSON rotation format (`skill_casts` plus `repeat`). */
export function readRotation(value: unknown, path = 'rotation'): Rotation {
  const reader = ObjectReader.of(value, path);
  const rotation: Rotation = {
    skillCasts: reader.array('skill_casts', (item, itemPath) => {
      const itemReader = ObjectReader.of(item, itemPath);
      const cast = { skill: itemReader.string('skill'), castTimeMs: itemReader.integer('cast_time_ms', 0) };
      itemReader.done();
      if (cast.castTimeMs < 0) {
        throw new ConfigurationError(
          'configuration.negative-cast-time',
          itemPath,
          'cast_time_ms must be non-negative.'
        );
      }

      return cast;
    }),
    repeat: reader.boolean('repeat', false)
  };
  reader.done();
  return rotation;
}

/**
 * Converts the upstream CLI's CSV rotation (`name, Time: 1.234s`) exactly as
 * `convert_encounter` does: seconds are floored to whole milliseconds and the
 * first row's time becomes the zero offset. This is the reference input
 * boundary, not a general timestamp conversion for the engine.
 */
export function readRotationCsv(text: string): Rotation {
  const lines = String(text).split(/\r?\n/);
  const skillCasts: SkillCast[] = [];
  let offset = 0;
  for (const [lineIndex, line] of lines.slice(1).entries()) {
    if (line === '') continue;
    const delimiter = line.indexOf(',');
    if (delimiter === -1) {
      throw new ConfigurationError(
        'configuration.invalid-rotation-csv',
        `rotation[${lineIndex}]`,
        'missing delimiter.'
      );
    }

    const timeText = line.slice(delimiter + 2);
    let end = timeText.indexOf(',');
    if (end === -1) end = timeText.length;
    const seconds = Number.parseFloat(timeText.slice(6, end - 1));
    if (!Number.isFinite(seconds)) {
      throw new ConfigurationError('configuration.invalid-rotation-csv', `rotation[${lineIndex}]`, 'invalid time.');
    }

    const castTimeMs = Math.floor(seconds * 1000);
    if (skillCasts.length === 0) offset = -castTimeMs;
    skillCasts.push({ skill: line.slice(0, delimiter), castTimeMs: castTimeMs + offset });
  }

  return { skillCasts, repeat: false };
}

function readTermination(value: unknown, path: string): TerminationCondition {
  const reader = ObjectReader.of(value, path);
  const type = requireValue(reader.enumValue('type', TERMINATION_TABLE, null), reader.child('type'), 'type');
  const time = reader.integer('time', 0);
  const actor = reader.string('actor');
  const damage = reader.integer('damage', 0);
  reader.done();
  if (type === 'TIME') return { type, time };
  if (type === 'DAMAGE') return { type, actor, damage };
  return { type, actor };
}

/**
 * Parses an encounter whose actors carry inline `build` and `rotation` objects.
 * Upstream's file-path encounter is resolved into this shape by headless callers.
 */
export function readEncounter(value: unknown, path = 'encounter'): Encounter {
  const reader = ObjectReader.of(value, path);
  const actors = reader.array('actors', (item, itemPath) => {
    const actorReader = ObjectReader.of(item, itemPath);
    const actor: EncounterActor = {
      name: actorReader.string('name'),
      build: readBuild(actorReader.raw('build'), actorReader.child('build')),
      rotation: actorReader.has('rotation')
        ? readRotation(actorReader.raw('rotation'), actorReader.child('rotation'))
        : { skillCasts: [], repeat: false },
      team: actorReader.integer('team', 0)
    };
    actorReader.string('audit_base_path');
    actorReader.done();
    return actor;
  });

  const auditsToPerform = reader.has('audit_configuration')
    ? (() => {
        const auditReader = ObjectReader.of(reader.raw('audit_configuration'), reader.child('audit_configuration'));
        const audits = auditReader.array('audits_to_perform', (item, itemPath) =>
          requireValue(readEnum(item, AUDIT_TABLE, itemPath), itemPath, 'audit type')
        );
        auditReader.done();
        return new Set(audits);
      })()
    : new Set<AuditType>([...AUDIT_TABLE.values()].filter((entry): entry is AuditType => entry != null));

  const encounter: Encounter = {
    actors,
    terminationConditions: reader.array('termination_conditions', readTermination),
    auditsToPerform,
    requireAfkSkills: reader.boolean('require_afk_skills', false),
    conditionTickOffset: reader.integer('condition_tick_offset', 0),
    weaponStrengthMode: requireValue(
      reader.enumValue('weapon_strength_mode', WEAPON_STRENGTH_TABLE, 'MEAN'),
      reader.child('weapon_strength_mode'),
      'weapon_strength_mode'
    ),
    criticalStrikeMode: requireValue(
      reader.enumValue('critical_strike_mode', CRITICAL_STRIKE_TABLE, 'MEAN'),
      reader.child('critical_strike_mode'),
      'critical_strike_mode'
    )
  };
  reader.integer('audit_offset', 0);
  reader.done();

  const names = new Set<string>();
  for (const [index, actor] of actors.entries()) {
    if (!actor.name || names.has(actor.name) || actor.name === 'Console') {
      throw new ConfigurationError(
        'configuration.invalid-actor-name',
        `${path}.actors[${index}].name`,
        'actor names must be unique, non-empty, and not "Console".'
      );
    }

    names.add(actor.name);
  }

  if (encounter.terminationConditions.length === 0) {
    throw new ConfigurationError(
      'configuration.missing-termination',
      `${path}.termination_conditions`,
      'at least one termination condition is required so the run is bounded.'
    );
  }

  return deepFreeze(encounter);
}

/**
 * The pinned reference gives three skill names built-in behavior. This engine
 * expresses that behavior as content flags instead, so the shared core never
 * branches on a skill name. Upstream builds are translated here, at the input
 * boundary; explicit flags already present in the build are left untouched.
 */
export const UPSTREAM_SKILL_CONVENTIONS = Object.freeze({
  weaponSwapSkill: 'Weapon Swap',
  skipOnStrikeHooksSkill: 'Lifesteal Proc',
  whirlFinisherSkills: Object.freeze([Object.freeze({ combo_field: 'fire', skill_key: 'Burning Bolts' })])
});

/** Adds the flags upstream implies by skill name to a build JSON object (and its inline recipes). */
export function withUpstreamSkillConventions(build: unknown): unknown {
  if (build == null || typeof build !== 'object' || Array.isArray(build)) return build;
  const source = build as JsonObject;
  const flagSkills = (skills: unknown) =>
    Array.isArray(skills)
      ? skills.map((skill: unknown) => {
          if (skill == null || typeof skill !== 'object') return skill;
          const entry = skill as JsonObject;
          if (entry.skill_key === UPSTREAM_SKILL_CONVENTIONS.weaponSwapSkill && !Object.hasOwn(entry, 'weapon_swap')) {
            return { ...entry, weapon_swap: true };
          }

          if (
            entry.skill_key === UPSTREAM_SKILL_CONVENTIONS.skipOnStrikeHooksSkill &&
            !Object.hasOwn(entry, 'skip_on_strike_hooks')
          ) {
            return { ...entry, skip_on_strike_hooks: true };
          }

          return entry;
        })
      : skills;
  const recipes = Array.isArray(source.recipes)
    ? source.recipes.map((recipe: unknown) =>
        recipe != null && typeof recipe === 'object'
          ? Object.hasOwn(recipe as JsonObject, 'skills')
            ? { ...(recipe as JsonObject), skills: flagSkills((recipe as JsonObject).skills) }
            : recipe
          : recipe
      )
    : source.recipes;
  const hasWhirlMapping = [source, ...(Array.isArray(recipes) ? recipes : [])].some(
    (recipe) =>
      recipe != null && typeof recipe === 'object' && Object.hasOwn(recipe as JsonObject, 'whirl_finisher_skills')
  );

  return {
    ...source,
    ...(Object.hasOwn(source, 'skills') ? { skills: flagSkills(source.skills) } : {}),
    ...(recipes === undefined ? {} : { recipes }),
    // Upstream applies its fire-field whirl combo to every actor, so the mapping is added unless content declares one.
    ...(hasWhirlMapping ? {} : { whirl_finisher_skills: UPSTREAM_SKILL_CONVENTIONS.whirlFinisherSkills })
  };
}

/**
 * Resolves upstream's file-based encounter (`build_path`, `rotation_path`,
 * `recipe_paths`) into the inline JSON shape `readEncounter` accepts. File
 * access is injected so the engine stays headless; CSV rotations use the
 * reference CLI conversion, and recipe files are appended after inline recipes,
 * which is the order the reference registers them in. Builds also receive the
 * flags upstream implies by skill name (see `withUpstreamSkillConventions`).
 */
export function resolveUpstreamEncounter(localEncounter: unknown, readText: (path: string) => string): unknown {
  const reader = ObjectReader.of(localEncounter, 'encounter');
  const { actors: rawActors, ...rest } = localEncounter as JsonObject;
  if (!Array.isArray(rawActors)) {
    throw new ConfigurationError('configuration.expected-array', reader.child('actors'), 'expected an array.');
  }

  const actors = rawActors.map((rawActor, index) => {
    const path = `encounter.actors[${index}]`;
    const actorReader = ObjectReader.of(rawActor, path);
    const { build_path: buildPath, rotation_path: rotationPath, ...actor } = rawActor as JsonObject;
    const build = JSON.parse(readText(readString(buildPath, `${path}.build_path`))) as JsonObject;
    const recipePaths = Array.isArray(build.recipe_paths) ? build.recipe_paths : [];
    const resolvedBuild = withUpstreamSkillConventions({
      ...build,
      recipes: [
        ...(Array.isArray(build.recipes) ? build.recipes : []),
        ...recipePaths.map((recipePath, recipeIndex) =>
          JSON.parse(readText(readString(recipePath, `${path}.build.recipe_paths[${recipeIndex}]`)))
        )
      ],
      recipe_paths: []
    });

    const rotationFile = actorReader.string('rotation_path');
    let rotation: unknown;
    if (rotationFile.endsWith('.json')) {
      // The reference CLI copies only the casts, so a file's `repeat` flag never reaches the encounter.
      const parsed = readRotation(JSON.parse(readText(rotationFile)), `${path}.rotation`);
      rotation = {
        skill_casts: parsed.skillCasts.map((cast) => ({ skill: cast.skill, cast_time_ms: cast.castTimeMs })),
        repeat: false
      };
    } else if (rotationFile.endsWith('.csv')) {
      const csv = readRotationCsv(readText(rotationFile));
      rotation = {
        skill_casts: csv.skillCasts.map((cast) => ({ skill: cast.skill, cast_time_ms: cast.castTimeMs })),
        repeat: false
      };
    } else if (rotationPath !== undefined && rotationFile !== '') {
      throw new ConfigurationError(
        'configuration.unsupported-rotation-file',
        `${path}.rotation_path`,
        'rotation files must be .json or .csv.'
      );
    }

    return { ...actor, build: resolvedBuild, ...(rotation === undefined ? {} : { rotation }) };
  });

  return { ...rest, actors };
}

/** Prepared content is shared by repeated runs, so it is frozen against accidental mutation. */
function deepFreeze<T>(value: T): T {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (value instanceof Map || value instanceof Set) return Object.freeze(value);
  for (const nested of Object.values(value as object)) deepFreeze(nested);
  return Object.freeze(value);
}
