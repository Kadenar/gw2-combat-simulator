/**
 * Static Evoker lookup tables shared by the mechanics modules.
 *
 * Skill-ID lookup tables. Patchable tuning lives with
 * its owning skill, trait, or shared mechanic and is read through the shared contract.
 */
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/** Every familiar skill ID, basic and empowered, mapped to the element it requires. */
export const FAMILIAR_ELEMENTS: ReadonlyMap<SkillId, ElementalistAttunement> = new Map([
  [ID.IGNITE, 'Fire'],
  [ID.CONFLAGRATION, 'Fire'],
  [ID.SPLASH, 'Water'],
  [ID.BUOYANT_DELUGE, 'Water'],
  [ID.ZAP, 'Air'],
  [ID.LIGHTNING_BLITZ, 'Air'],
  [ID.CALCIFY, 'Earth'],
  [ID.SEISMIC_IMPACT, 'Earth']
]);

/** The four non-empowered familiar skills: they spend the full charge bar and add an empowered stack. */
export const BASIC_FAMILIARS: ReadonlySet<SkillId> = new Set([ID.IGNITE, ID.SPLASH, ID.ZAP, ID.CALCIFY]);
