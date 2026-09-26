import type { SkillTaskData } from '#gw2/platform/simulation/runtime-state.js';
/** Owns Signet of Fire's passive-disable window across its active recharge. */
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Disables the passive until recharge unless Written in Stone preserves it. */
export const elementalistSignetTasks = Object.freeze({
  'elementalist.core.disable-signet-of-fire-passive': (context: ElementalistRuntime, data: unknown): void => {
    const { skill } = (data as SkillTaskData).cast;
    const at = context.time;
    if (hasTrait(context, 'Written in Stone')) return;
    const state = professionCoreState(context);
    state.signetOfFireDisabledUntil = Number(context.cooldowns.get(skill.id) || at);
    context.emit({
      type: 'elementalist.signet-fire',
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name,
      disabledUntil: state.signetOfFireDisabledUntil
    });
  }
});
