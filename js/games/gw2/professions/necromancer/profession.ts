import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  createNecromancerBuildDefaults,
  migrateNecromancerBuild,
  validateNecromancerBuild
} from '#gw2/professions/necromancer/build/build.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerNativeModules } from '#gw2/professions/necromancer/catalog.js';

export { necromancerCatalog, necromancerNativeModules } from '#gw2/professions/necromancer/catalog.js';

export const necromancerProfession = defineNativeProfession({
  id: 'necromancer',
  name: 'Necromancer',
  build: {
    createBuildDefaults: createNecromancerBuildDefaults,
    migrateBuild: migrateNecromancerBuild,
    validateBuild: validateNecromancerBuild
  },
  modules: necromancerNativeModules,
  autoattackChains: {
    overrides: [
      {
        // Sword retains its pending projectile step across other weapon casts only.
        id: 'necromancer.weapon-skills-preserve-sword',
        chainRootIds: [ID.ENERVATION_BLADE],
        when: ({ interruptingSkill }) => interruptingSkill.type === 'Weapon',
        decision: 'preserve'
      },
      {
        // Entering or leaving shroud resets weapon-chain state even without a direct damage packet.
        id: 'necromancer.form-casts-reset',
        when: ({ interruptingSkill }) =>
          Boolean(interruptingSkill.shroud || interruptingSkill.shroudEntry || interruptingSkill.shroudExit),
        decision: 'reset'
      }
    ]
  }
});

export default necromancerProfession;
