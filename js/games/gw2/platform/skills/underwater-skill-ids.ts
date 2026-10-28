/** API records omit underwater flags on these skills; exclude them from land catalogs and log replay. */
export const UNDERWATER_ONLY_SKILL_IDS: ReadonlySet<number> = new Set([
  // Deploy Mine replaces Throw Mine underwater, including its Gadgeteer variant.
  6163, // Deploy Mine
  30893, // Deploy Mine (Gadgeteer)
  // Conduit's water buttons omit the Underwater flag; land uses 77141/77159 and 76968.
  76805, // Beguiling Haze
  76917, // Beguiling Haze follow-up
  77001, // Twin Moon Sweep
  // Amphibious Ranger pets use separate Beast commands underwater.
  12656, // Icy Bite — Snow Leopard
  12688, // Enfeebling Maul — Black Bear
  12689, // Icy Maul — Polar Bear
  12690, // Poisonous Maul — Murellow
  12691, // Purge Conditions — Brown Bear
  12695, // Boil — Salamander Drake
  12697, // Frost Nova — Ice Drake
  12699, // Electrocute — River Drake
  12700, // Poison Cloud — Marsh Drake
  12702, // Poison Cloud — Whiptail Devourer
  12703, // Regenerate — Carrion Devourer
  12704, // Lashtail Venom — Lashtail Devourer
  16427, // Sonic Barrier — Reef Drake
  // Soulbeast skills belonging exclusively to aquatic pets.
  41837, // Dark Water — Jellyfish
  42717, // Protection — Armor Fish
  42797, // Charging Bite — Shark
  43186, // Healing Cloud — Jellyfish
  44360, // Fear — Shark
  44885, // Chomp — Armor Fish
  // Warrior underwater bursts, including the Spellbreaker variants.
  14443, // Whirling Strike
  14544, // Forceful Shot
  30989, // Burning Shackles
  31048, // Wild Whirl
  41330, // Forceful Shot
  41746 // Whirling Strike
]);
