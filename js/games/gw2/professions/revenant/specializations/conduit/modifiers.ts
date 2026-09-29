import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { conduitEntityModifierRules } from '#gw2/professions/revenant/specializations/conduit/skills/entity-skills.js';
import {
  affinity,
  modifyConduitAttributes
} from '#gw2/professions/revenant/specializations/conduit/traits/behavior.js';

export const conduitModifierRules = Object.freeze<readonly Gw2ModifierRule[]>([
  {
    id: 'revenant.release-dervish-assassin-affinity',
    order: 101,
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { damagePerAffinity: 0.1 },
    factor: (context, _target, parameters) => 1 + affinity(context) * parameters.damagePerAffinity,
    when: (context) =>
      ([ID.RELEASE_POTENTIAL_DERVISH, ID.RELEASE_POTENTIAL_ASSASSIN] as readonly number[]).includes(
        Number(context.event?.skillId)
      )
  },
  {
    id: 'revenant.release-warrior-affinity',
    order: 102,
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { damagePerAffinity: 0.15 },
    factor: (context, _target, parameters) => 1 + affinity(context) * parameters.damagePerAffinity,
    when: (context) => context.event?.skillId === ID.RELEASE_POTENTIAL_WARRIOR
  },
  ...conduitEntityModifierRules
]);

export const conduitModifiers = Object.freeze({
  modifierRules: conduitModifierRules,
  modifyAttributes: modifyConduitAttributes
});
