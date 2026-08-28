import { FOOD_DATA } from '../../platform/equipment/consumables/food.js';
import {
  UTILITY_CONVERSION_RATES,
  UTILITY_DATA,
  UTILITY_STAT_DATA
} from '../../platform/equipment/consumables/utilities.js';
import { RUNE_DATA } from '../../platform/equipment/gear/runes.js';
import { GEAR_STATS } from '../../platform/equipment/gear/stats.js';
import { RELIC_DATA } from '../../platform/equipment/relics/catalog.js';
import { SIGIL_PROCS } from '../../platform/equipment/sigils/catalog.js';
import { SIGIL_DATA } from '../../platform/equipment/sigils/data.js';

type NumericValues = Readonly<Record<string, number>>;
type UnknownValues = Readonly<Record<string, unknown>>;

const gearStats = GEAR_STATS as Readonly<Record<string, Readonly<Record<string, NumericValues>>>>;
const foodData = FOOD_DATA as Readonly<Record<string, UnknownValues>>;
const relicData = RELIC_DATA as Readonly<Record<string, UnknownValues>>;
const runeData = RUNE_DATA as Readonly<Record<string, { stats: NumericValues; durations: NumericValues }>>;
const sigilProcs = SIGIL_PROCS as Readonly<Record<string, UnknownValues>>;
const utilityData = UTILITY_DATA as Readonly<
  Record<string, readonly { readonly from: string; readonly to: string; readonly percent?: number }[]>
>;
const utilityStatData = UTILITY_STAT_DATA as Readonly<Record<string, NumericValues>>;

function optionLabel(name: string, details: readonly string[]): string {
  return details.length ? `${name} — ${details.join(', ')}` : name;
}

function attributeDetails(values: NumericValues | undefined, percent = false): string[] {
  const entries = Object.entries(values || {});
  const amounts = new Set(entries.map(([, value]) => value));
  if (entries.length >= 8 && amounts.size === 1) {
    return [`+${entries[0][1]}${percent ? '%' : ''} all attributes`];
  }

  return entries.map(([attribute, value]) => `+${value}${percent ? '%' : ''} ${attribute}`);
}

/** Adds visible catalog effects to native dropdown labels so choices can be compared without hover text. */
export function prefixOptionLabel(name: string, slot?: string): string {
  const stats = gearStats[name]?.[slot || 'Helm'];
  return optionLabel(name, slot ? attributeDetails(stats) : Object.keys(stats || {}));
}

export function runeOptionLabel(name: string): string {
  const rune = runeData[name];
  return optionLabel(name, [...attributeDetails(rune?.stats), ...attributeDetails(rune?.durations, true)]);
}

function foodProcDetail(proc: UnknownValues | undefined): string {
  if (!proc) return '';
  const chance = `${Math.round(Number(proc.chance || 0) * 100)}% on critical hit`;
  const cooldown = proc.icdMs ? ` (${Number(proc.icdMs) / 1000}s CD)` : '';
  if (proc.flatDamage) return `${chance}: ${proc.flatDamage} damage${cooldown}`;

  const effect = (value: unknown): string => {
    const data = value as UnknownValues | undefined;
    if (!data) return '';
    const stacks = Number(data.stacks || 1);
    return `${stacks > 1 ? `${stacks} ` : ''}${String(data.name || '')}${data.duration ? ` for ${data.duration}s` : ''}`;
  };

  const day = effect(proc.dayEffect);
  const night = effect(proc.nightEffect);
  return day || night ? `${chance}: ${day} by day / ${night} by night${cooldown}` : chance;
}

export function foodOptionLabel(name: string): string {
  const food = foodData[name];
  const proc = foodProcDetail(food?.proc as UnknownValues | undefined);
  return optionLabel(name, [
    ...attributeDetails(food?.stats as NumericValues | undefined),
    ...attributeDetails(food?.durations as NumericValues | undefined, true),
    ...(proc ? [proc] : [])
  ]);
}

export function utilityOptionLabel(name: string): string {
  const conversions = utilityData[name] || [];
  const firstPercent = conversions[0]?.percent;
  const uniformSelfConversion =
    conversions.length > 4 &&
    firstPercent != null &&
    conversions.every(({ from, to, percent }) => from === to && percent === firstPercent);
  const conversionDetails = uniformSelfConversion
    ? [`+${firstPercent}% all attributes`]
    : conversions.map(({ from, to, percent }) =>
        `+${percent ?? UTILITY_CONVERSION_RATES[from as keyof typeof UTILITY_CONVERSION_RATES]}% of ${from} as ${to}`
      );
  return optionLabel(name, [...attributeDetails(utilityStatData[name]), ...conversionDetails]);
}

const SIGIL_PERCENT_FIELDS: Readonly<Record<string, string>> = {
  criticalChance: 'critical chance',
  strikeDamageA: 'strike damage',
  nightStrikeDamageM: 'strike damage at night',
  conditionDamageA: 'condition damage',
  conditionDuration: 'condition duration',
  bleedingDuration: 'bleeding duration',
  burningDuration: 'burning duration',
  poisonDuration: 'poison duration',
  tormentDuration: 'torment duration',
  boonDuration: 'boon duration'
};

function sigilProcDetail(name: string, proc: UnknownValues | undefined): string {
  if (!proc) return '';
  const condition = `${Number(proc.stacks || 1) > 1 ? `${proc.stacks} ` : ''}${String(proc.condition || '')}${
    proc.duration ? ` for ${proc.duration}s` : ''
  }`;
  const effect =
    proc.effect === 'strike'
      ? `${proc.coefficient} coefficient strike`
      : proc.effect === 'condition'
        ? condition
        : proc.effect === 'next-hit-condition'
          ? `next hit applies ${condition}`
          : proc.effect === 'strike-condition'
            ? `${proc.coefficient} coefficient strike + ${condition}`
            : proc.effect === 'endurance'
              ? `+${proc.amount} endurance`
              : proc.effect === 'severance'
                ? `+${SIGIL_DATA[name].procPrecision} Precision and +${SIGIL_DATA[name].procFerocity} Ferocity for ${proc.duration}s`
                : '';
  const trigger =
    {
      crit: 'on critical hit',
      swap: 'on weapon swap',
      strike: 'on strike',
      control: 'after disabling a foe'
    }[String(proc.trigger)] || '';
  return `${effect} ${trigger}${proc.cooldown ? ` (${proc.cooldown}s CD)` : ''}`.trim();
}

export function sigilOptionLabel(name: string): string {
  const sigil = SIGIL_DATA[name];
  const passiveDetails = Object.entries(SIGIL_PERCENT_FIELDS).flatMap(([field, label]) =>
    sigil?.[field] ? [`+${sigil[field]}% ${label}`] : []
  );
  const proc = sigilProcDetail(name, sigilProcs[name]);
  return optionLabel(name, [...passiveDetails, ...(proc ? [proc] : [])]);
}

export function relicOptionLabel(name: string): string {
  const relic = relicData[name];
  const trigger = String(relic?.trigger || '');
  const cooldown = Number(relic?.cooldown || 0);
  return optionLabel(name, trigger ? [`${trigger}${cooldown ? ` (${cooldown}s ICD)` : ''}`] : []);
}
