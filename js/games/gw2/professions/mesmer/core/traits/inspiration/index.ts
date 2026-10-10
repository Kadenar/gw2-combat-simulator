import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { createMesmerIllusionRewards, mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-resources.js';

/** Focus recharge reduction applies through the shared cooldown controller, including Alacrity. */
export const wardensFeedback = defineTrait<MesmerSkill>({
  id: TRAIT.WARDENS_FEEDBACK,
  name: "Warden's Feedback",
  balance: { rechargeMultiplier: 0.8 },
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === 'Focus',
      multiplier: { profile: TRAIT.WARDENS_FEEDBACK, field: 'rechargeMultiplier' }
    }
  ]
});

/** Committed combat heals use the shared resource owner to create a clone, stock a blade, or grant a note. */
export const egoRestoration = defineTrait<MesmerSkill>({
  id: TRAIT.EGO_RESTORATION,
  name: 'Ego Restoration',
  triggers: [
    {
      on: 'castCommit',
      run(runtime, cast) {
        if (!runtime.combatStartedAt() || cast.skill.type !== 'Heal') return;
        createMesmerIllusionRewards(runtime).gainResources(
          runtime.time,
          1,
          mesmerActivePrimaryWeapon(runtime),
          cast.skill.name,
          {
            kind: 'trait',
            sourceSkillId: cast.skill.id,
            traitId: TRAIT.EGO_RESTORATION,
            traitName: 'Ego Restoration'
          }
        );
      }
    }
  ]
});
