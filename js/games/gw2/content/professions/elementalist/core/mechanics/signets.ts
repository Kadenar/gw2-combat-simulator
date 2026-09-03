/** Owns Signet of Fire's passive-disable window across its active recharge. */
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import type { ElementalistSchedulerContext } from '#gw2/content/professions/elementalist/types.js';

/** Disables the passive until recharge unless Written in Stone preserves it. */
export const elementalistSignetMechanicHandlers = Object.freeze({
  'elementalist.core.disable-signet-of-fire-passive': ({
    context,
    skill,
    at
  }: {
    context: ElementalistSchedulerContext;
    skill: Skill;
    at: number;
  }): void => {
    if (hasTrait(context, 'Written in Stone')) return;
    const state = professionCoreState(context);
    state.signetOfFireDisabledUntil = Number(context.state.cooldowns.get(skill.id) || at);
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
