import { consumeCharge } from '#gw2/platform/combat/resources/charges.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { weaponSpellChargeEffects } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/weapon-spells.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

// Each packet names its individual creature; weapon-spell stacks follow that owner before its stat
// attribution, so player-scaled spirit packets cannot spend the player's stacks.
function recipientKeys(event: NecromancerResolverEvent): string[] {
  if (event.summonOwner) return [event.summonOwner];

  if (event.actorType === ACTOR.PLAYER) return [ACTOR.PLAYER];

  return [];
}

/** Previews use a personal charge. Live hits spend the triggering recipient's charge before emitting these packets. */
export function queueWeaponSpellCharge(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  skill: Skill,
  recipient: 'personal' | 'shared' = 'personal',
  effects = weaponSpellChargeEffects(skill)
): void {
  if (!effects.length) return;

  const source = {
    at: event.at,
    skillName: skill.name,
    procType: 'profession' as const,
    icon: skill.icon || '',
    source: 'Weapon Spell',
    sourceId: skill.id,
    triggeredBy: event.skillName,
    ...(event.metadata?.triggeredByAlly == null
      ? {}
      : { metadata: { triggeredByAlly: event.metadata.triggeredByAlly } })
  };

  for (const effect of effects) {
    if (effect.type === 'condition') {
      context.effects.emit({
        kind: 'packet',
        event: buildResolverCondition({ ...effect, ...source, name: skill.name })
      });
      continue;
    }

    // Splinter belongs to the caster even on an ally hit. Only personal siphons inherit the caster's bonuses.
    const siphon = skill.id === ID.NIGHTMARE_WEAPON;
    const name = siphon ? `${skill.name} (${recipient === 'personal' ? 'Personal' : 'Shared'})` : skill.name;
    const { type: _type, ...strike } = effect;
    context.effects.emit({
      kind: 'packet',
      event: buildResolverStrike({
        ...strike,
        ...source,
        name,
        ...(siphon ? { damageBreakdownName: name } : {}),
        ...(!siphon || recipient === 'personal' ? { ownerActorType: ACTOR.PLAYER } : {}),
        skillId: skill.id,
        skillWeapon: 'Unequipped'
      })
    });
  }

  context.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'skill',
      name: skill.name,
      at: event.at,
      sourceSkill: event.skillName,
      detail: '',
      icon: source.icon
    }
  });
}

// Spend eligible recipients' weapon-spell charges when their damaging strikes resolve.
function reactToDamage(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;

  // Splinter damage belongs to the caster even when an ally triggers it, so it spends the caster's Nightmare charges.
  // Other derived damage cannot chain weapon spells, and Nightmare's life steal never triggers Splinter.
  if (event.actorType === ACTOR.EFFECT) {
    if (event.sourceId === ID.SPLINTER_WEAPON) triggerRitualistWeaponSpell(context, event, 'nightmare', [ACTOR.PLAYER]);

    return;
  }

  const keys = recipientKeys(event);

  if (!keys.length) return;

  for (const spell of ['nightmare', 'splinter'] as const) triggerRitualistWeaponSpell(context, event, spell, keys);
}

/** Actual player, companion, and modeled ally opportunities consume the same per-recipient grants. */
export function triggerRitualistWeaponSpell(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  spell: 'nightmare' | 'splinter',
  keys: readonly string[]
): void {
  const active = ritualistState.from(context.profession).weaponSpells[spell];

  if (!active) return;

  const definition = requireSkill(context.helpers, spell === 'nightmare' ? ID.NIGHTMARE_WEAPON : ID.SPLINTER_WEAPON);
  const effects = weaponSpellChargeEffects(definition);

  if (!effects.length) return;

  const internalCooldown = skillNumber(definition, 'internalCooldown');
  for (const key of keys) {
    if (!consumeCharge(active.recipients[key], event.at, internalCooldown)) continue;

    queueWeaponSpellCharge(context, event, definition, key === ACTOR.PLAYER ? 'personal' : 'shared', effects);
  }
}

/** Exposes Ritualist's hit-triggered weapon-spell reaction. */
export const ritualistResolverEventReactions = Object.freeze({
  damage: reactToDamage
});
