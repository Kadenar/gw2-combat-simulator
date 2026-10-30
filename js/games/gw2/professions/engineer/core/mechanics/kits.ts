import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast as denyEngineerCast } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import type { EngineerRuntime, EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Kit bars replace weapon skills and only selected, inactive kits can be equipped. */
export function engineerKitAvailability(
  context: MechanicQueriesOf<EngineerRuntime>,
  skill: EngineerSkill
): AvailabilityResult {
  const state = professionCoreState(context);

  if (skill.kitId) {
    if (state.activeKit !== skill.kitId) {
      return denyEngineerCast(
        skill,
        'engineer.inactive-kit',
        `equip ${context.helpers.skillsById.get(skill.kitId)?.name} first.`
      );
    }
  } else if (skill.type === 'Weapon' && state.activeKit) {
    // active kit completely replaces the weapon bar; baseline weapon skills are inaccessible
    return denyEngineerCast(skill, 'engineer.weapon-bar-replaced', 'the active kit replaces weapon skills.');
  }

  if (skill.kitTransition === 'equip') {
    if (
      context.config.selectedSkillIds !== undefined &&
      !selectedSkillIdSet(context.config.selectedSkillIds).has(skill.id)
    ) {
      return denyEngineerCast(skill, 'engineer.kit-not-equipped', 'the kit is not selected in a slot.');
    }

    if (state.activeKit === skill.id) {
      return denyEngineerCast(skill, 'engineer.kit-active', `use Stow ${skill.name} to leave this kit.`);
    }
  }

  return { ready: true };
}

/** Isolated damage queries select the kit bar needed by the requested occurrence. */
const prepareEngineerKitDamageState: NonNullable<
  RuntimeHooks<EngineerRuntimeState, EngineerSkill>['prepareDamageState']
> = (runtime, skill) => {
  if (skill?.kitId != null) runtime.profession.core.activeKit = skill.kitId;
};

/** A swap input stows the current kit before a later input can change the equipped weapon set. */
const resolveEngineerKitSkill: NonNullable<RuntimeHooks<EngineerRuntimeState, EngineerSkill>['resolveCastSkill']> = (
  context,
  skill
) => {
  const kit = context.profession.core.activeKit;

  if (skill.id !== SHARED_SKILL_IDS.SWAP_WEAPONS || !kit) return skill;

  const stow = context.helpers.skills.find(
    (candidate) => candidate.kitTransition === 'stow' && candidate.kitId === kit
  );

  if (!stow) throw new Error('Active kit has no stow action.');

  return stow;
};

/** Committed kit transitions update bundle identity before publishing the sigil-swap event. */
const engineerKitActions: NonNullable<RuntimeHooks<EngineerRuntimeState, EngineerSkill>['sideEffectHandlers']> = {
  'engineer.kit-transition'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Kit transitions require a cast trigger.');

    const { cast } = context;
    const skill = context.skill;
    // Persist bundle identity as the equip skill ID; labels belong to presentation.
    runtime.profession.core.activeKit = skill.kitTransition === 'equip' ? skill.id : null;
    buildEngineerPackets(
      'sigil_swap',
      { at: runtime.time, activationId: cast.id, weaponSet: runtime.activeWeaponSet },
      skill
    ).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
  }
};

/** Kit equip and stow actions, isolated kit previews, and kit skill resolution share one owner. */
export const engineerKitLifecycle = {
  sideEffectHandlers: engineerKitActions,
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState: prepareEngineerKitDamageState,
  resolveCastSkill: resolveEngineerKitSkill
} satisfies RuntimeHooks<EngineerRuntimeState, EngineerSkill>;
