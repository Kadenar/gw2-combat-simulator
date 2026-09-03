/**
 * Composes the disjoint Core Ranger pet-family catalogs.
 * Individual family fragments remain in the sibling files.
 */
import type { SkillFragment } from '#gw2/platform/engine/types.js';
import { RANGER_CORE_FELINE_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/feline.js';
import { RANGER_CORE_PORCINE_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/porcine.js';
import { RANGER_CORE_CANINE_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/canine.js';
import { RANGER_CORE_URSINE_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/ursine.js';
import { RANGER_CORE_DEVOURER_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/devourer.js';
import { RANGER_CORE_DRAKE_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/drake.js';
import { RANGER_CORE_AVIAN_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/avian.js';
import { RANGER_CORE_MOA_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/moa.js';
import { RANGER_CORE_SHARK_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/shark.js';
import { RANGER_CORE_SPIDER_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/spider.js';
import { RANGER_CORE_ARMOR_FISH_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/armor-fish.js';
import { RANGER_CORE_JELLYFISH_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/jellyfish.js';
import { RANGER_CORE_SMOKESCALE_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/smokescale.js';
import { RANGER_CORE_WYVERN_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/wyvern.js';
import { RANGER_CORE_BRISTLEBACK_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/bristleback.js';
import { RANGER_CORE_JACARANDA_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/jacaranda.js';
import { RANGER_CORE_ROCK_GAZELLE_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/rock-gazelle.js';
import { RANGER_CORE_FANGED_IBOGA_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/fanged-iboga.js';
import { RANGER_CORE_PHOENIX_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/phoenix.js';
import { RANGER_CORE_TURTLE_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/turtle.js';
import { RANGER_CORE_AETHER_HUNTER_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/aether-hunter.js';
import { RANGER_CORE_CHAK_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/chak.js';
import { RANGER_CORE_SPINEGAZER_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/spinegazer.js';
import { RANGER_CORE_WARCLAW_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/warclaw.js';
import { RANGER_CORE_JANTHIRI_BEE_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/janthiri-bee.js';
import { RANGER_CORE_RAPTOR_SWIFTWING_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/raptor-swiftwing.js';
import { RANGER_CORE_RIVER_OTTER_PET_SKILL_MECHANICS } from '#gw2/content/professions/ranger/core/skills/pets/river-otter.js';

export const RANGER_CORE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...RANGER_CORE_FELINE_PET_SKILL_MECHANICS,
  ...RANGER_CORE_PORCINE_PET_SKILL_MECHANICS,
  ...RANGER_CORE_CANINE_PET_SKILL_MECHANICS,
  ...RANGER_CORE_URSINE_PET_SKILL_MECHANICS,
  ...RANGER_CORE_DEVOURER_PET_SKILL_MECHANICS,
  ...RANGER_CORE_DRAKE_PET_SKILL_MECHANICS,
  ...RANGER_CORE_AVIAN_PET_SKILL_MECHANICS,
  ...RANGER_CORE_MOA_PET_SKILL_MECHANICS,
  ...RANGER_CORE_SHARK_PET_SKILL_MECHANICS,
  ...RANGER_CORE_SPIDER_PET_SKILL_MECHANICS,
  ...RANGER_CORE_ARMOR_FISH_PET_SKILL_MECHANICS,
  ...RANGER_CORE_JELLYFISH_PET_SKILL_MECHANICS,
  ...RANGER_CORE_SMOKESCALE_PET_SKILL_MECHANICS,
  ...RANGER_CORE_WYVERN_PET_SKILL_MECHANICS,
  ...RANGER_CORE_BRISTLEBACK_PET_SKILL_MECHANICS,
  ...RANGER_CORE_JACARANDA_PET_SKILL_MECHANICS,
  ...RANGER_CORE_ROCK_GAZELLE_PET_SKILL_MECHANICS,
  ...RANGER_CORE_FANGED_IBOGA_PET_SKILL_MECHANICS,
  ...RANGER_CORE_PHOENIX_PET_SKILL_MECHANICS,
  ...RANGER_CORE_TURTLE_PET_SKILL_MECHANICS,
  ...RANGER_CORE_AETHER_HUNTER_PET_SKILL_MECHANICS,
  ...RANGER_CORE_CHAK_PET_SKILL_MECHANICS,
  ...RANGER_CORE_SPINEGAZER_PET_SKILL_MECHANICS,
  ...RANGER_CORE_WARCLAW_PET_SKILL_MECHANICS,
  ...RANGER_CORE_JANTHIRI_BEE_PET_SKILL_MECHANICS,
  ...RANGER_CORE_RAPTOR_SWIFTWING_PET_SKILL_MECHANICS,
  ...RANGER_CORE_RIVER_OTTER_PET_SKILL_MECHANICS
});
