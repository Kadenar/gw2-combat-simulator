/** Own the player swing and Innervate commands, including the live-spirit requirement for Innervate. */
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { weaponStrengthProfileForName } from '#gw2/platform/equipment/weapons/strength.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  attribution,
  spiritFields,
  spiritImpactAt
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/attribution.js';
import { ritualistPartyBoonPolicy } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/party-boons.js';
import { spiritDefinition } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import type { NecromancerRuntimeState, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

const INNERVATE = new Map<SkillId, string>([
  [ID.INNERVATE_ANGUISH, 'anguish'],
  [ID.INNERVATE_WANDERLUST, 'wanderlust'],
  [ID.INNERVATE_PRESERVATION, 'preservation']
]);

/** Keep player action admission beside its execution without exposing spirit lifecycle operations. */
export const ritualistPlayerActionHooks: RuntimeHooks<NecromancerRuntimeState, NecromancerSkill> = {
  availability(runtime, skill) {
    const key = INNERVATE.get(skill.id);
    return key && !ritualistState.from(runtime.profession).activeSpirits[key]
      ? denySkillCast(skill, 'necromancer.spirit', `requires an active ${key} spirit.`)
      : { ready: true };
  },
  sideEffectHandlers: {
    'ritualist.wanderlust-opening'(runtime, context) {
      if (context.kind !== 'cast' || context.cast.cancelledBeforeCommit) return;

      const cast = context.cast;
      const swing = spiritDefinition(runtime, cast.skill.id)?.summon?.ticks[0];

      if (!swing) return;

      const skillWeapon = gw2ActivePrimaryWeapon(runtime.config, runtime.activeWeaponSet) || 'Unequipped';
      runtime.effects.emit({
        kind: 'packet',
        event: buildResolverStrike({
          ...attribution(cast),
          source: 'necromancer',
          at: spiritImpactAt(cast.start, cast, swing.atMs),
          coefficient: swing.coefficient,
          skillWeapon,
          weaponStrengthProfileId: weaponStrengthProfileForName(skillWeapon)?.id
        })
      });
    },
    'ritualist.innervate'(runtime, context) {
      if (context.kind !== 'cast') return;

      const cast = context.cast;
      const innervate = INNERVATE.get(cast.skill.id)!;
      for (const effect of cast.skill.effects ?? []) {
        if (effect.type === 'boon') {
          runtime.effects.emit({
            kind: 'profile',
            profile: cast.skill,
            effects: [effect],
            ...ritualistPartyBoonPolicy(runtime, cast)
          });
        } else
          runtime.effects.emit({
            kind: 'profile',
            profile: cast.skill,
            effects: [effect],
            at: runtime.time,
            attribution: { ...attribution(cast), ...spiritFields(innervate, 'innervate') },
            skillWeaponFallback: 'Profession mechanic',
            transform: (event) => ({ ...event, at: gw2Time(event.at + (cast.command.impactDelayMs ?? 0) / 1000) })
          });
      }
    }
  }
};
