import { WEAPON } from '#gw2/platform/constants.js';
import { sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { controlOnSkillBar } from '#gw2/platform/skills/input-controls.js';
import type { InputControlId } from '#gw2/platform/skills/input-controls.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { engineerBuffPolicies } from '#gw2/professions/engineer/core/effect-state.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { notifyToolbeltActivation } from '#gw2/professions/engineer/core/mechanics/toolbelt.js';
import { dodgeAccepted } from '#gw2/professions/engineer/core/mechanics/trigger-points.js';
import { engineerCoreCastAvailability } from '#gw2/professions/engineer/core/mechanics/availability.js';
import { engineerKitLifecycle } from '#gw2/professions/engineer/core/mechanics/kits.js';
import { reduceEngineerRecharge } from '#gw2/professions/engineer/core/mechanics/recharge.js';
import { engineerEndurance } from '#gw2/professions/engineer/core/mechanics/resources.js';
import { engineerSpearLifecycle } from '#gw2/professions/engineer/core/mechanics/spear.js';
import { engineerTurretLifecycle } from '#gw2/professions/engineer/core/mechanics/turrets.js';
import { handleAirBlast } from '#gw2/professions/engineer/core/skills/kits/flamethrower.js';
import { mineFieldLifecycle } from '#gw2/professions/engineer/core/skills/profession-skills.js';
import type { EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Shared toolbelt, dodge, and recharge wiring composed with each Core mechanic and skill owner's registered work. */
export const engineerCoreHooks = composeRuntimeHooks<EngineerRuntimeState, EngineerSkill>([
  engineerSpearLifecycle,
  engineerTurretLifecycle,
  engineerKitLifecycle,
  mineFieldLifecycle,
  {
    buffPolicies: engineerBuffPolicies,
    endurance: engineerEndurance,
    availability: engineerCoreCastAvailability,
    /** Toolbelt buttons follow the currently equipped heal/utility slot, including their flip skills. */
    resolveInputControl(context, skill) {
      const parent =
        skill.toolbeltParentId ??
        (skill.flipParentId != null ? context.helpers.skillsById.get(skill.flipParentId)?.toolbeltParentId : undefined);

      if (parent == null) return undefined;

      const bar = context.config.skillInputBars?.[0];
      const parentSkill = context.helpers.skillsById.get(parent);
      const slot = bar && parentSkill ? controlOnSkillBar(context.helpers, parentSkill, bar) : null;
      return slot?.startsWith('slot-')
        ? { control: `profession-${Number(slot.slice(5)) - 5}` as InputControlId }
        : { control: null, unresolvedReason: 'Toolbelt parent is not in the selected utility bar.' };
    },
    sideEffectHandlers: {
      // Both sword finishers declare the reward while live cooldown selection and proc reporting share one owner.
      'engineer.sword-recharge'(runtime, context, action) {
        if (action.type !== 'engineer.sword-recharge' || action.amount == null)
          throw new TypeError('Sword recharge reductions require an amount.');

        if (context.kind !== 'cast') throw new TypeError('Sword recharge requires a cast trigger.');

        const { cast } = context;
        reduceEngineerRecharge(
          runtime,
          cast,
          (candidate) =>
            candidate.type === 'Weapon' && candidate.weapon === WEAPON.SWORD && candidate.id !== cast.skill.id,
          sideEffectAmount(runtime, action.amount),
          cast.skill.id,
          'Gleam Saber \u2014 Sword Recharge'
        );
      }
    },
    onCastStart(runtime, cast) {
      if (cast.skill.independentCast) notifyToolbeltActivation(runtime, cast.skill);

      if (cast.skill.id !== SHARED_SKILL_IDS.DODGE) return;

      buildEngineerPackets('engineer.dodge', { at: runtime.time, activationId: cast.id }, cast.skill).forEach(
        (packet) => runtime.effects.emit({ kind: 'packet', event: packet })
      );
      runtime.fireTrigger(dodgeAccepted, { cast });
    },
    onCastCommit(runtime, cast) {
      // Independent commands notify at acceptance; ordinary toolbelt casts notify only on completion.
      if (!cast.skill.independentCast) notifyToolbeltActivation(runtime, cast.skill);
    },
    eventHandlers: {
      'engineer.air-blast': handleAirBlast
    }
  }
]);
