/** Canonical exotic item IDs verified against the public GW2 items API. */
export const SIGIL_IDS = Object.freeze({
  BLOODLUST: 24575,
  CORRUPTION: 24578,
  CRUELTY: 67341,
  STARS: 86170,
  ACCURACY: 24618,
  FORCE: 24615,
  BURSTING: 44944,
  MALICE: 44950,
  AGONY: 24612,
  SMOLDERING: 24624,
  VENOM: 24632,
  DEMONS: 24583,
  IMPACT: 24868,
  NIGHT: 36053,
  // Undead Slaying supplies the item identity for the generic matching-enemy build option.
  SLAYING: 24642,
  AIR: 24554,
  BLIGHT: 67913,
  EARTH: 24560,
  TORMENT: 48911,
  DOOM: 24609,
  ENERGY: 24607,
  GEOMANCY: 24605,
  HYDROMANCY: 24597,
  MISCHIEF: 68436,
  ICE: 24555,
  SEVERANCE: 84505,
  CONCENTRATION: 72339
});

/** Owns the static sigil tables: passive stat entries and active proc declarations. */
import type { Gw2SigilDataEntry } from '#gw2/platform/equipment/sigils/types.js';

// ─── Sigil Data ───────────────────────────────────────────────────────────────
// Stat values are percentages stored as numbers (e.g. 7 = 7%).
// Only non-zero fields are listed; all others default to 0 when accessed with ||0.
// Proc-only sigils have no passive numeric fields. Their active effect values
// remain in the proc declarations below rather than being folded into aggregate stats.
export const SIGIL_DATA: Readonly<Record<string, Gw2SigilDataEntry>> = {
  // Stacking sigils assume 25 prebuilt stacks, retained while either equipped set carries the sigil.
  Bloodlust: {
    id: SIGIL_IDS.BLOODLUST,
    stackingStats: { Power: 250 },
    icon: 'https://render.guildwars2.com/file/77AAE10D3E03036D6E00642DEF01E5DF3468524F/220673.png'
  },
  Corruption: {
    id: SIGIL_IDS.CORRUPTION,
    stackingStats: { 'Condition Damage': 250 },
    icon: 'https://render.guildwars2.com/file/D574E4D29FA31DB815F76FD5FE4CA1EBFACA22B9/220668.png'
  },
  Cruelty: {
    id: SIGIL_IDS.CRUELTY,
    stackingStats: { Ferocity: 250 },
    icon: 'https://render.guildwars2.com/file/057D6F9E40020AF09E420B09EBDB4FCD9DE37951/866846.png'
  },
  Stars: {
    id: SIGIL_IDS.STARS,
    stackingStats: {
      Power: 50,
      Precision: 50,
      Toughness: 50,
      Vitality: 50,
      Ferocity: 50,
      'Condition Damage': 50,
      Expertise: 50,
      Concentration: 50,
      'Healing Power': 50
    },
    icon: 'https://render.guildwars2.com/file/B9B778FD561C019DC5A3A01D55C234D1E31251CE/1894696.png'
  },
  Accuracy: {
    id: SIGIL_IDS.ACCURACY,
    criticalChance: 7,
    icon: 'https://render.guildwars2.com/file/4B0EFF29FD064E5E93E4F8616BE309A451450AED/220661.png'
  },
  Force: {
    id: SIGIL_IDS.FORCE,
    strikeDamageA: 5,
    icon: 'https://render.guildwars2.com/file/D7420E430D002E07382035EF0D0F77370C4EE6B8/220662.png'
  },
  Bursting: {
    id: SIGIL_IDS.BURSTING,
    conditionDamageA: 5,
    icon: 'https://render.guildwars2.com/file/7ABFCEDF80329157F734FD56B293765D9B940FAD/619703.png'
  },
  Malice: {
    id: SIGIL_IDS.MALICE,
    conditionDuration: 10,
    icon: 'https://render.guildwars2.com/file/797D052CB4EA63A61A3225962128D197ACB3ED17/619709.png'
  },
  Agony: {
    id: SIGIL_IDS.AGONY,
    bleedingDuration: 20,
    icon: 'https://render.guildwars2.com/file/BAF34EB051D118F8A7C1645E0D940ED0660E6269/220658.png'
  },
  Smoldering: {
    id: SIGIL_IDS.SMOLDERING,
    burningDuration: 20,
    icon: 'https://render.guildwars2.com/file/60AAB7109E5D679901E00DC066774EE5FB3E6052/220659.png'
  },
  Venom: {
    id: SIGIL_IDS.VENOM,
    poisonDuration: 20,
    icon: 'https://render.guildwars2.com/file/080B4F940A05E60A084AA4B1D230F923A1A47CEC/220664.png'
  },
  Demons: {
    id: SIGIL_IDS.DEMONS,
    tormentDuration: 20,
    icon: 'https://render.guildwars2.com/file/52D5D9FE5E0B9091415092A9E21DE830010D2E0E/220674.png'
  },
  Impact: {
    id: SIGIL_IDS.IMPACT,
    strikeDamageA: 3,
    icon: 'https://render.guildwars2.com/file/D9ACA0C94D90A76B1C500D5DE6D62B6820FEDAE2/221170.png'
  },
  Night: {
    id: SIGIL_IDS.NIGHT,
    strikeDamageA: 3,
    nightStrikeDamageM: 7,
    icon: 'https://render.guildwars2.com/file/CFDC642093029E790C03381D73C703BDFFA9CDFF/499391.png'
  },
  // One generic slaying sigil assumes a matching enemy, so both bonuses are always active.
  Slaying: {
    id: SIGIL_IDS.SLAYING,
    strikeDamageA: 3,
    strikeDamageM: 7,
    icon: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Superior_Sigil_of_Undead_Slaying.png'
  },
  Air: {
    id: SIGIL_IDS.AIR,
    icon: 'https://render.guildwars2.com/file/C337CC61DF2F5EE44B7D053EFF33059111024444/220676.png'
  },
  Blight: {
    id: SIGIL_IDS.BLIGHT,
    icon: 'https://render.guildwars2.com/file/AE0A1C7816B56296FEA527E1D01376491374195A/941026.png'
  },
  Earth: {
    id: SIGIL_IDS.EARTH,
    icon: 'https://render.guildwars2.com/file/251EE3B8B5ADB8D7F7A35DBAEFABA35AEACDF51B/220677.png'
  },
  Torment: {
    id: SIGIL_IDS.TORMENT,
    icon: 'https://render.guildwars2.com/file/E42EB6198022E5B4D71C5EE41465DD4EB84A0465/665778.png'
  },
  Doom: {
    id: SIGIL_IDS.DOOM,
    icon: 'https://render.guildwars2.com/file/6CE4D1D6E5392C4CC8BACA595E3393EBF208BEED/220686.png'
  },
  Energy: {
    id: SIGIL_IDS.ENERGY,
    icon: 'https://render.guildwars2.com/file/3A064B97AB7D0E1F1250EFB5F06798A8FE623708/220688.png'
  },
  Geomancy: {
    id: SIGIL_IDS.GEOMANCY,
    icon: 'https://render.guildwars2.com/file/B79B430645DDF54E6792909A52F5CA40A4911407/220687.png'
  },
  Hydromancy: {
    id: SIGIL_IDS.HYDROMANCY,
    icon: 'https://render.guildwars2.com/file/B5F3E2021863079919299707290698504B5C7E90/220689.png'
  },
  Mischief: {
    id: SIGIL_IDS.MISCHIEF,
    icon: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Superior_Sigil_of_Mischief.png'
  },
  Ice: {
    id: SIGIL_IDS.ICE,
    icon: 'https://render.guildwars2.com/file/10E0D93F4B303CD03F6FEE0C5AAEEB070E0EFAC1/220680.png'
  },
  Severance: {
    id: SIGIL_IDS.SEVERANCE,
    procPrecision: 250,
    procFerocity: 250,
    icon: 'https://render.guildwars2.com/file/396D7A5DBFA03BC49C12DAB532C4E34D342F0B51/1766396.png'
  },
  Concentration: {
    id: SIGIL_IDS.CONCENTRATION,
    boonDuration: 10,
    icon: 'https://render.guildwars2.com/file/C501D2CCF95A7B59F15EEDEF9C7D42C2DECE48E7/1201533.png'
  }
};

// ─── Sigil Procs ──────────────────────────────────────────────────────────────
/** Runtime rules use item IDs; names remain the public build and display vocabulary. */
export const SIGIL_BY_ID: Readonly<Record<number, Gw2SigilDataEntry & { readonly name: string }>> = Object.freeze(
  Object.fromEntries(Object.entries(SIGIL_DATA).map(([name, data]) => [data.id, { ...data, name }]))
);

export const SIGIL_PROCS = Object.freeze({
  [SIGIL_IDS.AIR]: {
    trigger: 'crit',
    cooldown: 3,
    effect: 'strike',
    coefficient: 1.1,
    canCrit: false,
    icon: SIGIL_BY_ID[SIGIL_IDS.AIR].icon
  },
  [SIGIL_IDS.TORMENT]: {
    trigger: 'crit',
    cooldown: 5,
    effect: 'condition',
    condition: 'Torment',
    stacks: 2,
    duration: 5,
    icon: SIGIL_BY_ID[SIGIL_IDS.TORMENT].icon
  },
  [SIGIL_IDS.EARTH]: {
    trigger: 'crit',
    cooldown: 2,
    effect: 'condition',
    condition: 'Bleeding',
    stacks: 1,
    duration: 6,
    icon: SIGIL_BY_ID[SIGIL_IDS.EARTH].icon
  },
  [SIGIL_IDS.BLIGHT]: {
    trigger: 'crit',
    cooldown: 8,
    effect: 'condition',
    condition: 'Poisoned',
    stacks: 2,
    duration: 4,
    icon: SIGIL_BY_ID[SIGIL_IDS.BLIGHT].icon
  },
  [SIGIL_IDS.DOOM]: {
    trigger: 'swap',
    cooldown: 9,
    effect: 'next-hit-condition',
    condition: 'Poisoned',
    stacks: 3,
    duration: 8,
    icon: SIGIL_BY_ID[SIGIL_IDS.DOOM].icon
  },
  [SIGIL_IDS.GEOMANCY]: {
    trigger: 'swap',
    cooldown: 9,
    effect: 'strike-condition',
    coefficient: 0.25,
    canCrit: true,
    condition: 'Bleeding',
    stacks: 3,
    duration: 8,
    icon: SIGIL_BY_ID[SIGIL_IDS.GEOMANCY].icon
  },
  [SIGIL_IDS.HYDROMANCY]: {
    trigger: 'swap',
    cooldown: 9,
    effect: 'strike-condition',
    coefficient: 1,
    canCrit: true,
    condition: 'Chilled',
    stacks: 1,
    duration: 2,
    icon: SIGIL_BY_ID[SIGIL_IDS.HYDROMANCY].icon
  },
  [SIGIL_IDS.MISCHIEF]: {
    // Snowballs select distinct foes, so the single simulated target receives one critical-capable hit and blind.
    trigger: 'swap',
    cooldown: 9,
    effect: 'strike-condition',
    coefficient: 0.15,
    canCrit: true,
    projectile: true,
    condition: 'Blindness',
    stacks: 1,
    duration: 2,
    icon: SIGIL_BY_ID[SIGIL_IDS.MISCHIEF].icon
  },
  [SIGIL_IDS.ICE]: {
    // Chills on a flanking strike or against a defiant foe; runtime checks the target before claiming the ICD.
    trigger: 'strike',
    cooldown: 10,
    effect: 'condition',
    condition: 'Chilled',
    stacks: 1,
    duration: 2,
    icon: SIGIL_BY_ID[SIGIL_IDS.ICE].icon
  },
  [SIGIL_IDS.ENERGY]: {
    trigger: 'swap',
    cooldown: 9,
    effect: 'endurance',
    amount: 50,
    icon: SIGIL_BY_ID[SIGIL_IDS.ENERGY].icon
  },
  [SIGIL_IDS.SEVERANCE]: {
    trigger: 'control',
    cooldown: 1,
    effect: 'severance',
    duration: 4,
    icon: SIGIL_BY_ID[SIGIL_IDS.SEVERANCE].icon
  }
});
