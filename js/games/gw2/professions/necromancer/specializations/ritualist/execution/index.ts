import { replaceSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import { necromancerSpiritSkillHandlers } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import { necromancerWeaponSpellSkillHandlers } from '#gw2/professions/necromancer/specializations/ritualist/execution/weapon-spells.js';

/** Ritualist callbacks own emission instead of the corresponding declarative effects. */
export const ritualistSkillHandlers = new Map([
  ['necromancer.ritualist', replaceSkillHandler(necromancerSpiritSkillHandlers['necromancer.ritualist'])],
  ['necromancer.innervate', replaceSkillHandler(necromancerSpiritSkillHandlers['necromancer.innervate'])],
  ['necromancer.weapon-spell', replaceSkillHandler(necromancerWeaponSpellSkillHandlers['necromancer.weapon-spell'])]
]);
