/** Shares only scalar strike formula inputs; copying preserves explicit zero/false and ignores absent overrides. */
export interface StrikePayloadFields {
  readonly weaponStrength?: number;
  readonly flatDamage?: number;
  readonly flatStrikeBase?: number;
  readonly flatStrikePowerCoeff?: number;
  readonly flatStrikeMultiplier?: number;
  readonly flatStrikeHealthThreshold?: number;
  readonly flatStrikeThresholdMultiplier?: number;
  readonly independentSummonStrike?: boolean;
  readonly summonUsesProfessionModifiers?: boolean;
  readonly summonInheritsAttributes?: boolean;
  readonly summonInheritsCriticalAttributes?: boolean;
  readonly canCrit?: boolean;
  readonly forceCrit?: boolean;
}

type StrikeFieldPolicy = {
  [K in keyof StrikePayloadFields]-?: NonNullable<StrikePayloadFields[K]> extends number
    ? 'number'
    : NonNullable<StrikePayloadFields[K]> extends boolean
      ? 'boolean'
      : never;
};

const strikeFieldPolicy = {
  weaponStrength: 'number',
  flatDamage: 'number',
  flatStrikeBase: 'number',
  flatStrikePowerCoeff: 'number',
  flatStrikeMultiplier: 'number',
  flatStrikeHealthThreshold: 'number',
  flatStrikeThresholdMultiplier: 'number',
  independentSummonStrike: 'boolean',
  summonUsesProfessionModifiers: 'boolean',
  summonInheritsAttributes: 'boolean',
  summonInheritsCriticalAttributes: 'boolean',
  canCrit: 'boolean',
  forceCrit: 'boolean'
} as const satisfies StrikeFieldPolicy;

// Object.keys loses literal keys; this exhaustive policy contains precisely the declared payload keys.
const strikePayloadKeys = Object.keys(strikeFieldPolicy) as (keyof StrikePayloadFields)[];

export const strikePayloadNumericKeys: readonly (keyof StrikePayloadFields)[] = Object.freeze(
  strikePayloadKeys.filter((key) => strikeFieldPolicy[key] === 'number')
);

type MutableStrikePayload = { -readonly [K in keyof StrikePayloadFields]: StrikePayloadFields[K] };

// A generic key preserves the field/value correlation without allocating a temporary object for each assignment.
function copyField<K extends keyof StrikePayloadFields>(
  source: Pick<StrikePayloadFields, K>,
  target: Pick<MutableStrikePayload, K>,
  key: K
): void {
  const value = source[key];

  if (value != null) target[key] = value;
}

/** Apply defined overrides directly to the packet under construction; absent fields retain its defaults. */
export function copyStrikePayload(source: StrikePayloadFields, target: MutableStrikePayload): void {
  for (const key of strikePayloadKeys) copyField(source, target, key);
}
