/**
 * Composes the disjoint Soulbeast family and archetype Beast-skill catalogs.
 * Individual family fragments remain in the sibling files.
 */
import type { SkillFragment } from '#gw2/platform/engine/types.js';
import { SOULBEAST_FANGED_IBOGA_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/fanged-iboga.js';
import { SOULBEAST_SMOKESCALE_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/smokescale.js';
import { SOULBEAST_FELINE_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/feline.js';
import { SOULBEAST_BRISTLEBACK_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/bristleback.js';
import { SOULBEAST_PORCINE_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/porcine.js';
import { SOULBEAST_DEVOURER_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/devourer.js';
import { SOULBEAST_ROCK_GAZELLE_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/rock-gazelle.js';
import { SOULBEAST_DRAKE_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/drake.js';
import { SOULBEAST_JELLYFISH_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/jellyfish.js';
import { SOULBEAST_AVIAN_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/avian.js';
import { SOULBEAST_ARMOR_FISH_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/armor-fish.js';
import { SOULBEAST_SHARK_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/shark.js';
import { SOULBEAST_CANINE_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/canine.js';
import { SOULBEAST_URSINE_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/ursine.js';
import { SOULBEAST_MOA_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/moa.js';
import { SOULBEAST_SPIDER_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/spider.js';
import { SOULBEAST_JACARANDA_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/jacaranda.js';
import { SOULBEAST_WYVERN_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/wyvern.js';
import { SOULBEAST_PHOENIX_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/phoenix.js';
import { SOULBEAST_TURTLE_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/turtle.js';
import { SOULBEAST_AETHER_HUNTER_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/aether-hunter.js';
import { SOULBEAST_CHAK_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/chak.js';
import { SOULBEAST_SPINEGAZER_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/spinegazer.js';
import { SOULBEAST_WARCLAW_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/warclaw.js';
import { SOULBEAST_JANTHIRI_BEE_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/janthiri-bee.js';
import { SOULBEAST_RAPTOR_SWIFTWING_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/raptor-swiftwing.js';
import { SOULBEAST_RIVER_OTTER_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/river-otter.js';
import { SOULBEAST_ARCHETYPE_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/archetype.js';
import { SOULBEAST_WINGED_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/winged.js';
import { SOULBEAST_SUPPLEMENTAL_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/supplemental.js';

export const SOULBEAST_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...SOULBEAST_FANGED_IBOGA_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_SMOKESCALE_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_FELINE_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_BRISTLEBACK_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_PORCINE_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_DEVOURER_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_ROCK_GAZELLE_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_DRAKE_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_JELLYFISH_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_AVIAN_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_ARMOR_FISH_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_SHARK_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_CANINE_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_URSINE_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_MOA_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_SPIDER_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_JACARANDA_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_WYVERN_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_PHOENIX_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_TURTLE_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_AETHER_HUNTER_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_CHAK_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_SPINEGAZER_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_WARCLAW_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_JANTHIRI_BEE_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_RAPTOR_SWIFTWING_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_RIVER_OTTER_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_ARCHETYPE_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_WINGED_BEAST_SKILL_MECHANICS,
  ...SOULBEAST_SUPPLEMENTAL_BEAST_SKILL_MECHANICS
});
