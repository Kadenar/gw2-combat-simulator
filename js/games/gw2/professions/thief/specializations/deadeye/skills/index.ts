import type { Skill } from '#gw2/platform/skills/types.js';
import { DEADEYE_MARK_SKILLS } from '#gw2/professions/thief/specializations/deadeye/skills/deadeyes-mark.js';
import { DEADEYE_MALICIOUS_ATTACKS } from '#gw2/professions/thief/specializations/deadeye/skills/malicious-attacks.js';
import { DEADEYE_SLOT_SKILLS } from '#gw2/professions/thief/specializations/deadeye/skills/slot-skills.js';
import { DEADEYE_STOLEN_SKILLS } from '#gw2/professions/thief/specializations/deadeye/skills/stolen-skills.js';

/** Compose complete skill families; effects, actions, and modifiers stay with their declaring family. */
export const DEADEYE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  ...DEADEYE_STOLEN_SKILLS,
  ...DEADEYE_MARK_SKILLS,
  ...DEADEYE_SLOT_SKILLS,
  ...DEADEYE_MALICIOUS_ATTACKS
});
