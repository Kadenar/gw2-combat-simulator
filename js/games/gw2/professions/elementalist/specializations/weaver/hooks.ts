import { WEAPON } from '#gw2/platform/constants.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { targetAttunement } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { skillWeapon } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { weaverBuffPolicies } from '#gw2/professions/elementalist/specializations/weaver/effect-state.js';
import { weaverAttunementLifecycle } from '#gw2/professions/elementalist/specializations/weaver/mechanics/attunements.js';
import { weaverDualAttunements } from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-weapon-state.js';
import { weaverPistolLifecycle } from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/pistol.js';
import { weaverSpearLifecycle } from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/spear.js';
import {
  primordialStancePulse,
  schedulePrimordialStance
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/primordial-stance.js';
import { triggerWeaverSpearFollowups } from '#gw2/professions/elementalist/specializations/weaver/mechanics/spear-followups.js';
import { weaverCastCompleted } from '#gw2/professions/elementalist/specializations/weaver/mechanics/trigger-points.js';
import {
  startWeaveSelfCast,
  weaveSelfLifecycle
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/weave-self.js';
import {
  applyFerventStance,
  ferventStanceLifecycle
} from '#gw2/professions/elementalist/specializations/weaver/skills/slot-skills.js';
import type { ElementalistRuntimeState, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Wire hand transitions and stance owners; completion traits precede the Fervent Stance reward. */
export const weaverHooks = composeRuntimeHooks<ElementalistRuntimeState, ElementalistSkill>([
  weaverAttunementLifecycle,
  weaverPistolLifecycle,
  weaverSpearLifecycle,
  weaveSelfLifecycle,
  ferventStanceLifecycle,
  {
    buffPolicies: weaverBuffPolicies,
    reactions: { 'damage.resolved': triggerWeaverSpearFollowups },
    // The Air bullet and Flow State reductions compose without consuming bullet state during lookup.
    rechargeRules: [
      {
        when: (context, skill) => skill.id === ID.PURBLINDING_PLASMA && professionCoreState(context).pistolBullets.Air,
        multiplier: { skillField: 'airBulletRechargeMultiplier' }
      }
    ],
    // Dual orbs share their cast lifetime so Grand Finale retires both hands' pending contacts.
    effectOwner(context, event) {
      const skill = context.skillFor(event.skillId ?? event.sourceId);

      if (
        skill &&
        skillWeapon(skill) === WEAPON.HAMMER &&
        weaverDualAttunements(skill) &&
        (event.type === 'damage' || event.type === 'condition')
      )
        return { id: String(event.activationId), generation: 0 };

      return undefined;
    },
    sideEffectHandlers: {
      'elementalist.weaver.start-weave-self'(runtime, context) {
        if (context.kind !== 'cast') throw new TypeError('Weave Self requires a cast trigger.');

        startWeaveSelfCast(runtime, context.cast, context.skill);
      },
      'elementalist.weaver.start-primordial-stance'(runtime, context) {
        if (context.kind !== 'cast') throw new TypeError('Primordial Stance requires a cast trigger.');

        schedulePrimordialStance(runtime, context.cast, context.skill);
      }
    },
    onCastCommit(runtime, cast) {
      const skill = cast.skill;

      if (targetAttunement(skill)) return;

      const dualAttunements = weaverDualAttunements(skill);
      runtime.fireTrigger(weaverCastCompleted, { cast, dualAttunements });
      applyFerventStance(runtime, cast, dualAttunements);
    },
    tasks: {
      'elementalist.primordial-stance': primordialStancePulse
    }
  }
]);
