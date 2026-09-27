import { RESOURCE_KEYS } from '#gw2/platform/combat/resources/resource-policy.js';
import type { CanonicalCatalog, Skill, SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { SideEffectAction } from '#gw2/platform/simulation/side-effects.js';

/** Validate literal and selected-profile amounts without coercion before a declaration can mutate runtime state. */
function validateSideEffectAmount(catalog: CanonicalCatalog, amount: unknown, label: string, skill?: Skill): void {
  let value = amount;
  if (amount && typeof amount === 'object' && !Array.isArray(amount)) {
    const reference = amount as { profile?: SkillId; field?: string; skillField?: string };
    if ('skillField' in reference) {
      // Only resource grants supply the current skill; other action amounts retain profile/literal semantics.
      if (
        !skill ||
        typeof reference.skillField !== 'string' ||
        !Object.hasOwn(skill, reference.skillField) ||
        Object.keys(reference).length !== 1
      )
        throw new TypeError(`${label} requires an existing numeric skill field.`);
      value = skill[reference.skillField];
    } else {
      const profile = reference.profile == null ? undefined : catalog.balanceProfilesById.get(reference.profile);
      if (!profile || typeof reference.field !== 'string' || !Object.hasOwn(profile, reference.field))
        throw new TypeError(`${label} requires an existing balance profile field.`);
      value = profile[reference.field];
    }
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new TypeError(`${label} must be finite and non-negative.`);
}

function validateFinitePriority(value: unknown, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} priority must be finite.`);
}

/** Shared validation keeps cast declarations and resolved-effect actions on the same contract. */
export function validateSideEffectAction(catalog: CanonicalCatalog, skill: Skill, action: SideEffectAction): void {
  if (!action || typeof action !== 'object' || Array.isArray(action) || typeof action.type !== 'string')
    throw new TypeError(`Skill ${skill.id} has an invalid side-effect action.`);
  const label = `Skill ${skill.id} side effect ${action.type}`;
  switch (action.type) {
    case 'rechargeReset':
    case 'ammoRestore':
      if (!Array.isArray(action.skillIds)) throw new TypeError(`${label} requires a skillIds array.`);
      for (const id of action.skillIds) {
        const target = catalog.skillsById.get(id);
        if (!target) throw new TypeError(`${label} references missing skill ${id}.`);
        if (action.type === 'ammoRestore' && !(Number(target.ammo) > 0))
          throw new TypeError(`${label} requires an ammo skill: ${id}.`);
      }

      if (action.type === 'ammoRestore') validateSideEffectAmount(catalog, action.count, `${label} count`);
      break;
    case 'resourceGrant':
      if (action.resource !== 'endurance' && !RESOURCE_KEYS.includes(action.resource))
        throw new TypeError(`${label} references unknown resource ${action.resource}.`);
      validateSideEffectAmount(catalog, action.amount, `${label} amount`, skill);
      break;
    case 'flipArm':
      if (action.expiryPriority !== undefined) validateFinitePriority(action.expiryPriority, label);
      if (!catalog.skillsById.has(action.skillId))
        throw new TypeError(`${label} references missing skill ${action.skillId}.`);
      // Indefinite flips are explicit; missing duration still requires authored skill tuning.
      if (action.durationSec !== null)
        validateSideEffectAmount(
          catalog,
          action.durationSec === undefined ? skill.flipDuration : action.durationSec,
          `${label} duration`
        );
      break;
    case 'flipConsume':
      if (!catalog.skillsById.has(action.skillId))
        throw new TypeError(`${label} references missing skill ${action.skillId}.`);
      break;
    case 'emitProfile':
      if (!catalog.balanceProfilesById.has(action.profileId))
        throw new TypeError(`${label} references missing profile ${action.profileId}.`);
      // Profile selection must be callable before runtime emission can apply any rewards.
      if (action.effects != null && typeof action.effects !== 'function')
        throw new TypeError(`${label} effects must be a predicate.`);
      if (action.attribution != null && (typeof action.attribution !== 'object' || Array.isArray(action.attribution)))
        throw new TypeError(`${label} attribution must be an object.`);
      break;
    default:
      // Namespaced profession actions are bound to handlers when the selected runtime modules are assembled.
      if (!/^[\w-]+(?:\.[\w-]+)+$/.test(action.type))
        throw new TypeError(`${label} is not a built-in or namespaced action.`);
      if (action.amount !== undefined) validateSideEffectAmount(catalog, action.amount, `${label} amount`);
  }
}

/** Validate selected variants too: a runtime transform cannot bypass the authored reaction contract. */
export function validateEffectReactions(catalog: CanonicalCatalog, skill: Skill, effect: SkillEffect): void {
  if (effect.reactions === undefined) return;
  if (!Array.isArray(effect.reactions)) throw new TypeError(`Skill ${skill.id} reactions must be an array.`);
  const stage = (
    { strike: 'damage.resolved', condition: 'condition.applied', control: 'control.resolved' } as Record<string, string>
  )[effect.type];
  for (const rule of effect.reactions) {
    if (
      !rule ||
      !stage ||
      rule.on !== stage ||
      !['player', 'summon', 'effect'].includes(rule.actor) ||
      !['each', 'first'].includes(rule.packets) ||
      (rule.when !== undefined && typeof rule.when !== 'function')
    )
      throw new TypeError(`Skill ${skill.id} has an invalid effect reaction.`);
    const actions = Array.isArray(rule.do) ? rule.do : [rule.do];
    if (!actions.length) throw new TypeError(`Skill ${skill.id} reaction requires an action.`);
    for (const action of actions) {
      validateSideEffectAction(catalog, skill, action);
      if (action.type === 'flipArm' || action.type === 'flipConsume')
        throw new TypeError(`${action.type} requires a cast trigger.`);
    }
  }
}
