import { STATUS } from '#gw2/platform/constants.js';
import {
  hasActionEffects,
  type PayloadSideEffectAction,
  type SideEffectAction
} from '#gw2/platform/effects/actions.js';
import type { BuffEffect, SkillEffect } from '#gw2/platform/effects/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** The trigger owns its Stealth duration so a patch changes both the grant and its strike protection. */
export function thiefStealthGrant(duration: number): PayloadSideEffectAction {
  return {
    type: 'thief.stealth',
    id: 'stealth',
    effects: [{ type: 'buff', kind: STATUS.STEALTH, duration, stacks: 1 }]
  };
}

/** Read the grant from its commit rule or the strike selected for this cast. Tooltips use the catalog's base strike. */
export function findThiefStealthGrant(skill: Skill, effects = skill.effects) {
  const commit = skill.sideEffects?.find((rule) => rule.on === 'castCommit' && rule.do.type === 'thief.stealth');
  const action = commit?.do ?? impactGrant(effects);

  const buffs = stealthGrantBuffs(action);

  if (buffs.length) return { effects: buffs, commit };
}

/** Patches can remove or disable individual buffs in the dispatched action. */
export function stealthGrantBuffs(action: SideEffectAction | undefined): readonly BuffEffect[] {
  if (!hasActionEffects(action)) return [];

  return action.effects.filter(
    (effect): effect is BuffEffect => effect.type === 'buff' && effect.kind === STATUS.STEALTH && effect.duration > 0
  );
}

/** Find the Stealth action on the selected strike, including a strike supplied by a variant. */
function impactGrant(effects: readonly SkillEffect[] = []) {
  for (const effect of effects)
    for (const reaction of effect.reactions ?? []) {
      const grant = reaction.do.find((action) => action.type === 'thief.stealth');

      if (grant) return grant;
    }
}
