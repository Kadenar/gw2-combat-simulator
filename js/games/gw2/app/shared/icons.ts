import type { Gw2ProcStep } from '#gw2/platform/resolver/types.js';
import { RELIC_DATA } from '#gw2/platform/equipment/relics/data.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

export const PLACEHOLDER_ICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23232632"/%3E%3Cpath d="M17 46L32 13l15 33z" fill="%23a38ad5"/%3E%3C/svg%3E';

export const REFRESH_ARROW_ICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="6" fill="%23232632"/%3E%3Cpath d="M49 21A20 20 0 1 0 52 39" fill="none" stroke="%23d8c7ff" stroke-width="7" stroke-linecap="round"/%3E%3Cpath d="M49 9v13H36" fill="none" stroke="%23d8c7ff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/%3E%3C/svg%3E';

export const COMBAT_START_ICON = 'https://wiki.guildwars2.com/images/e/e9/Call_Target.png';

// Mushroom King's Blessing reuses Cap Hop's icon in the training area.
export const COOLDOWN_RESET_ICON = 'https://wiki.guildwars2.com/images/8/86/Cap_Hop.png';

export const WAIT_ICON = 'https://wiki.guildwars2.com/images/8/83/%22sipcoffee%22_Emote_Tome.png';

export const ACTION_ICONS: Readonly<Record<string, string>> = {
  Dodge: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
  'Dodge / Mirage Cloak': 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
  'Pick Up Mirage Mirror': 'https://render.guildwars2.com/file/7F3FA1CD20D930E7EEC75459E7206979DD0AD016/1770518.png',
  'Mirage Mirror': 'https://render.guildwars2.com/file/7F3FA1CD20D930E7EEC75459E7206979DD0AD016/1770518.png',
  'Swap Weapons': 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
  'Continuum Shift': 'https://wiki.guildwars2.com/images/d/d7/Continuum_Shift.png'
};

export const RESULT_PROC_NAMES: Readonly<Record<string, string>> = {
  'Phantasmal Blade': 'Phantasmal Blades',
  'Cascading Corruption': 'Meltdown'
};

/** Use the game's direct render assets for tooltip facts, build controls, and effect result rows. */
export const MODIFIER_EFFECT_ICONS: Readonly<Record<string, string>> = {
  'Strike damage': 'https://render.guildwars2.com/file/61AA4919C4A7990903241B680A69530121E994C7/156657.png',
  Recharge: 'https://render.guildwars2.com/file/D767B963D120F077C3B163A05DC05A7317D7DB70/156651.png',
  'Energy cost': 'https://assets.gw2dat.com/156647.png',
  'Crushing Abyss': 'https://render.guildwars2.com/file/632F757C2309C12BCFE99FCCE4BB761FA59AECEE/3379187.png',
  // Control facts use the game's distinct disable glyphs; unspecified controls use the defiance glyph.
  Daze: 'https://render.guildwars2.com/file/9AE125E930C92FEA0DD99E7EBAEDE4CF5EC556B6/433474.png',
  Stun: 'https://render.guildwars2.com/file/1999B9DB355005D2DD19F66DFFBAA6D466057508/522727.png',
  Knockdown: 'https://render.guildwars2.com/file/7632087376D36B0D100F1B07BE53F154BC337D7C/2440716.png',
  Knockback: 'https://render.guildwars2.com/file/400B7FD39724FBD700B94AB8AB52B5B9167646F4/2440715.png',
  Pull: 'https://assets.gw2dat.com/2440717.png',
  Launch: 'https://assets.gw2dat.com/2440712.png',
  Float: 'https://assets.gw2dat.com/2440713.png',
  Sink: 'https://assets.gw2dat.com/2440714.png',
  Control: 'https://assets.gw2dat.com/1938788.png',
  Defiance: 'https://assets.gw2dat.com/1938788.png',
  Blind: 'https://render.guildwars2.com/file/09770136BB76FD0DBE1CC4267DEED54774CB20F6/102837.png',
  Ammunition: 'https://render.guildwars2.com/file/B4490FB81AA1E7C06F1B22056AE09A0F54CBE2C4/1770201.png',
  Combo: 'https://render.guildwars2.com/file/A513F3653D33FBA4220D2D307799F8A327A36A3B/156656.png',
  // Generic numeric facts use the game's book icon, including affinity and endurance gains.
  Affinity: 'https://render.guildwars2.com/file/9352ED3244417304995F26CB01AE76BB7E547052/156661.png',
  Endurance: 'https://render.guildwars2.com/file/9352ED3244417304995F26CB01AE76BB7E547052/156661.png',
  'Life Force': 'https://render.guildwars2.com/file/9352ED3244417304995F26CB01AE76BB7E547052/156661.png',
  'Condition Threshold': 'https://render.guildwars2.com/file/9352ED3244417304995F26CB01AE76BB7E547052/156661.png',
  'Conditions Transferred': 'https://render.guildwars2.com/file/9352ED3244417304995F26CB01AE76BB7E547052/156661.png',
  Blight: 'https://render.guildwars2.com/file/6B797B70EF545937F677BCD463BD23DC749B0801/2479350.png',
  Meltdown: 'https://render.guildwars2.com/file/03291423C8D1BE039F100726B40BC218F021EFEF/3790487.png',
  Power: 'https://render.guildwars2.com/file/D6CAECEA0FD5FADE04DD6970384ADC5DE309C506/2229322.png',
  Precision: 'https://render.guildwars2.com/file/C2CEA567E0C43C199C782809544721AA12A6DF0A/2229323.png',
  Ferocity: 'https://render.guildwars2.com/file/0658D833944E69E62E08EB18A0B5407F722125BC/2229320.png',
  Toughness: 'https://render.guildwars2.com/file/432C0F04F740C1377E6D5D56640B57083C031216/2229324.png',
  Vitality: 'https://render.guildwars2.com/file/CAE8B4C43FF9D203FA55016700420A0454DFFE02/2229325.png',
  'Healing Power': 'https://render.guildwars2.com/file/9B986DEADC035E58C364A1423975F5F538FC2202/2229321.png',
  'Condition Damage': 'https://render.guildwars2.com/file/0120CB042BFC2EA6A45BC3DB45155FECDDDE1910/2229318.png',
  Expertise: 'https://render.guildwars2.com/file/4977CD5BAF0A7B6412DCC775C3909F7D4EFE4C65/2229319.png',
  Concentration: 'https://render.guildwars2.com/file/6574560606F6BA1B32E9CF0F6C9709D1C1F2D9A6/2207782.png',
  Stability: 'https://render.guildwars2.com/file/3D3A1C2D6D791C05179AB871902D28782C65C244/415959.png',
  Resistance: 'https://render.guildwars2.com/file/50BAC1B8E10CFAB9E749A5D910D4A9DCF29EBB7C/961398.png',
  Blinded: 'https://render.guildwars2.com/file/09770136BB76FD0DBE1CC4267DEED54774CB20F6/102837.png',
  Crippled: 'https://render.guildwars2.com/file/070325E519C178D502A8160523766070D30C0C19/102838.png',
  Immobile: 'https://render.guildwars2.com/file/397A613651BFCA2832B6469CE34735580A2C120E/102844.png',
  Immobilized: 'https://render.guildwars2.com/file/397A613651BFCA2832B6469CE34735580A2C120E/102844.png',
  Might: 'https://render.guildwars2.com/file/2FA9DF9D6BC17839BBEA14723F1C53D645DDB5E1/102852.png',
  Fury: 'https://render.guildwars2.com/file/96D90DF84CAFE008233DD1C2606A12C1A0E68048/102842.png',
  Quickness: 'https://render.guildwars2.com/file/D4AB6401A6D6917C3D4F230764452BCCE1035B0D/1012835.png',
  Alacrity: 'https://render.guildwars2.com/file/4FDAC2113B500104121753EF7E026E45C141E94D/1938787.png',
  Protection: 'https://render.guildwars2.com/file/CD77D1FAB7B270223538A8F8ECDA1CFB044D65F4/102834.png',
  Resolution: 'https://render.guildwars2.com/file/D104A6B9344A2E2096424A3C300E46BC2926E4D7/2440718.png',
  Regeneration: 'https://render.guildwars2.com/file/F69996772B9E18FD18AD0AABAB25D7E3FC42F261/102835.png',
  Swiftness: 'https://render.guildwars2.com/file/20CFC14967E67F7A3FD4A4B8722B4CF5B8565E11/102836.png',
  Vigor: 'https://render.guildwars2.com/file/58E92EBAF0DB4DA7C4AC04D9B22BCA5ECF0100DE/102843.png',
  Aegis: 'https://render.guildwars2.com/file/DFB4D1B50AE4D6A275B349E15B179261EE3EB0AF/102854.png',
  Burning: 'https://render.guildwars2.com/file/B47BF5803FED2718D7474EAF9617629AD068EE10/102849.png',
  Bleeding: 'https://render.guildwars2.com/file/79FF0046A5F9ADA3B4C4EC19ADB4CB124D5F0021/102848.png',
  Torment: 'https://render.guildwars2.com/file/10BABF2708CA3575730AC662A2E72EC292565B08/598887.png',
  Confusion: 'https://render.guildwars2.com/file/289AA0A4644F0E044DED3D3F39CED958E1DDFF53/102880.png',
  Poisoned: 'https://render.guildwars2.com/file/559B0AF9FB5E1243D2649FAAE660CCB338AACC19/102840.png',
  Vulnerability: 'https://render.guildwars2.com/file/3A394C1A0A3257EB27A44842DDEEF0DF000E1241/102850.png',
  Weakness: 'https://render.guildwars2.com/file/6CB0E64AF9AA292E332A38C1770CE577E2CDE0E8/102853.png',
  Blindness: 'https://render.guildwars2.com/file/09770136BB76FD0DBE1CC4267DEED54774CB20F6/102837.png',
  Slow: 'https://render.guildwars2.com/file/F60D1EF5271D7B9319610855676D320CD25F01C6/961397.png',
  Chilled: 'https://render.guildwars2.com/file/28C4EC547A3516AF0242E826772DA43A5EAC3DF3/102839.png',
  Cripple: 'https://render.guildwars2.com/file/070325E519C178D502A8160523766070D30C0C19/102838.png',
  Immobilize: 'https://render.guildwars2.com/file/397A613651BFCA2832B6469CE34735580A2C120E/102844.png',
  Fear: 'https://render.guildwars2.com/file/30307A6E766D74B6EB09EDA12A4A2DE50E4D76F4/102869.png',
  Taunt: 'https://render.guildwars2.com/file/02EED459AD65FAF7DF32A260E479C625070841B9/1228472.png'
};

const tooltipIconNames = Object.keys(MODIFIER_EFFECT_ICONS)
  .sort((a, b) => b.length - a.length)
  .map((name) => ({ icon: MODIFIER_EFFECT_ICONS[name], pattern: new RegExp(`\\b${name.toLowerCase()}\\b`) }));

/** Qualifiers change a fact's wording, not its icon; conversions use the destination attribute. */
export function tooltipFactIcon(name: string): string | undefined {
  const label = name.toLowerCase().split('converted to ').at(-1)!;
  if (/\b(?:recharge|cooldown)\b/.test(label)) return MODIFIER_EFFECT_ICONS.Recharge;
  if (/\bcritical(?:[- ]hit)? damage\b/.test(label)) return MODIFIER_EFFECT_ICONS.Ferocity;
  if (/\bcritical(?:[- ]strike)? chance\b/.test(label)) return MODIFIER_EFFECT_ICONS.Precision;
  if (/^damage\b|\bstrike(?: and condition)? damage\b/.test(label)) return MODIFIER_EFFECT_ICONS['Strike damage'];
  if (/\bcondition duration\b/.test(label)) return MODIFIER_EFFECT_ICONS.Expertise;
  if (/\bboon duration\b/.test(label)) return MODIFIER_EFFECT_ICONS.Concentration;
  const match = tooltipIconNames.find(({ pattern }) => pattern.test(label));
  return (
    match?.icon ||
    (/\b(?:damage|strikes?|coefficient)\b/.test(label) ? MODIFIER_EFFECT_ICONS['Strike damage'] : undefined)
  );
}

export function resolveRelicIcon(label: unknown): string {
  const value = String(label || '');
  const sourceName = value
    .match(/^relic[.:_-](.+)$/i)?.[1]
    ?.replace(/[._-]+/g, ' ')
    .trim()
    .toLowerCase();
  const relicData = RELIC_DATA;
  for (const [name, relic] of Object.entries(relicData)) {
    if (
      relic.icon &&
      (value === name ||
        value.startsWith(`Relic of ${name}`) ||
        value.startsWith(`Relic of the ${name}`) ||
        sourceName === name.toLowerCase())
    ) {
      return String(relic.icon);
    }
  }

  return '';
}

export function resolveProcIcon(app: ProfessionAppState, proc: Gw2ProcStep): string {
  if (Number(proc.cooldownReduction) > 0) return REFRESH_ARROW_ICON;
  const traits = app.attributeData?.activeTraits || [];
  const traitIcon = proc.type === 'trait_proc' ? traits.find((trait) => trait.name === proc.skill)?.icon : '';
  const relicIcon = proc.type === 'relic_proc' ? resolveRelicIcon(proc.skill) : '';
  const procSkillIcon = app.skillByName.get(proc.skill)?.icon;
  const sourceIcon = app.skillByName.get(proc.sourceSkill)?.icon;
  return String(proc.icon || traitIcon || relicIcon || procSkillIcon || sourceIcon || '');
}
