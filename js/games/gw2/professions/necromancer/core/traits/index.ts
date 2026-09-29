import { bloodMagicTraits } from '#gw2/professions/necromancer/core/traits/blood-magic.js';
import { cursesTraits } from '#gw2/professions/necromancer/core/traits/curses.js';
import { deathMagicTraits } from '#gw2/professions/necromancer/core/traits/death-magic.js';
import { soulReapingTraits } from '#gw2/professions/necromancer/core/traits/soul-reaping.js';
import { spiteTraits } from '#gw2/professions/necromancer/core/traits/spite.js';

/** Registers each native trait owner once; execution boundaries remain in the owning helpers. */
export const necromancerCoreTraits = [
  ...deathMagicTraits,
  ...soulReapingTraits,
  ...cursesTraits,
  ...bloodMagicTraits,
  ...spiteTraits
];
