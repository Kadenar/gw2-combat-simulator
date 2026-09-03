/** Registers Conduit cast callbacks while implementations remain with their skill families. */
import {
  castBeguilingHaze,
  castGladiatorsDefense,
  castHexEaterVortex,
  castTwinMoonSweep
} from '#gw2/content/professions/revenant/specializations/conduit/execution/entities.js';
import { castReleasePotential } from '#gw2/content/professions/revenant/specializations/conduit/execution/release-potential.js';
import { activateCosmicWisdom } from '#gw2/content/professions/revenant/specializations/conduit/execution/cosmic-wisdom.js';

export const revenantConduitSkillHandlers = Object.freeze({
  'revenant.beguiling-haze': castBeguilingHaze,
  'revenant.gladiators-defense': castGladiatorsDefense,
  'revenant.hex-eater-vortex': castHexEaterVortex,
  'revenant.twin-moon-sweep': castTwinMoonSweep,
  'revenant.release-potential': castReleasePotential,
  'revenant.cosmic-wisdom': activateCosmicWisdom
});
