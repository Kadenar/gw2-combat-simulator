import { consumeCharge } from '#gw2/platform/combat/resources/charges.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';

import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';

// Weapon-spell stacks follow the creature that owns an attack before its stat
// attribution, so player-scaled spirit packets cannot spend the player's stacks.
function recipientKeys(event: NecromancerResolverEvent): string[] {
  if (event.summonOwnerBase && (event.summonCount || 0) > 1) {
    return Array.from({ length: Number(event.summonCount) }, (_, index) => `${event.summonOwnerBase}:${index}`);
  }

  if (event.summonOwner) return [event.summonOwner];
  if (event.actorType === 'player') return ['player'];
  if (event.actorType !== 'summon') return [];

  return [];
}

function spellIcon(context: NecromancerResolverContext, skillId: SkillId): string {
  return context.helpers.skillsById.get(skillId)?.icon || '';
}

// Resolve a Nightmare Weapon stack as a non-critical life steal plus vulnerability,
// preserving whether the triggering strike belonged to an ally.
export function queueNightmareWeapon(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  definition: BalanceProfile,
  recipient: 'personal' | 'shared'
): void {
  // Attribute damage to the consumed grant: ally-triggered Splinter can still spend a personal Nightmare charge.
  const breakdownName = `Nightmare Weapon (${recipient === 'personal' ? 'Personal' : 'Shared'})`;
  const strike = requireEffect(definition, 'strike', 'Strike');
  const vulnerability = requireEffect(definition, 'condition', 'Vulnerability');
  // Materialize both components at the triggering strike's timestamp before recording the combined proc; each
  // survives the other's removal.
  if (strike)
    context.effects.emit({
      kind: 'packet',
      event: buildResolverStrike({
        at: event.at,

        skillName: 'Nightmare Weapon',
        name: breakdownName,
        damageBreakdownName: breakdownName,
        // Weapon spells own the damage of their consumed charges, including allied opportunities.
        procType: 'profession',
        icon: spellIcon(context, ID.NIGHTMARE_WEAPON),
        coefficient: 0,
        flatStrikeBase: effectNumber(definition, strike, 'flatStrikeBase'),
        flatStrikePowerCoeff: effectNumber(definition, strike, 'flatStrikePowerCoeff'),

        source: 'Weapon Spell',
        sourceId: ID.NIGHTMARE_WEAPON,
        actorType: 'effect',
        skillId: ID.NIGHTMARE_WEAPON,
        skillWeapon: 'Unequipped',
        canCrit: false,
        damageKind: 'life-steal',
        triggeredBy: event.skillName,
        // Derived spell packets inherit only ally attribution, not the triggering hit's other annotations.
        ...(event.metadata?.triggeredByAlly == null
          ? {}
          : { metadata: { triggeredByAlly: event.metadata.triggeredByAlly } })
      })
    });
  if (vulnerability)
    context.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        at: event.at,
        name: 'Nightmare Weapon',
        skillName: 'Nightmare Weapon',
        procType: 'profession',
        icon: spellIcon(context, ID.NIGHTMARE_WEAPON),
        condition: String(vulnerability.condition),
        stacks: effectNumber(definition, vulnerability, 'stacks'),
        duration: effectNumber(definition, vulnerability, 'duration'),
        source: 'Weapon Spell',
        sourceId: ID.NIGHTMARE_WEAPON,
        actorType: 'effect',
        triggeredBy: event.skillName,
        // Derived spell packets inherit only ally attribution, not the triggering hit's other annotations.
        ...(event.metadata?.triggeredByAlly == null
          ? {}
          : { metadata: { triggeredByAlly: event.metadata.triggeredByAlly } })
      })
    });
  context.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'skill',
      name: 'Nightmare Weapon',
      at: event.at,
      sourceSkill: event.skillName,
      detail: '',
      icon: spellIcon(context, ID.NIGHTMARE_WEAPON)
    }
  });
}

// Resolve a Splinter Weapon stack as a derived strike while preserving ally
// trigger attribution and proc logging.
export function queueSplinterWeapon(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  definition: BalanceProfile
): void {
  const strike = requireEffect(definition, 'strike', 'Strike');
  if (!strike) return;
  // Queue the derived strike first, then expose the same trigger through proc reporting.
  context.effects.emit({
    kind: 'packet',
    event: buildResolverStrike({
      at: event.at,

      skillName: 'Splinter Weapon',
      // The consuming attack is a trigger, while the weapon spell remains the damage owner.
      procType: 'profession',
      icon: spellIcon(context, ID.SPLINTER_WEAPON),
      coefficient: effectNumber(definition, strike, 'coefficient'),

      source: 'Weapon Spell',
      sourceId: ID.SPLINTER_WEAPON,
      actorType: 'effect',
      skillId: ID.SPLINTER_WEAPON,
      skillWeapon: 'Unequipped',
      triggeredBy: event.skillName,
      // Derived spell packets inherit only ally attribution, not the triggering hit's other annotations.
      ...(event.metadata?.triggeredByAlly == null
        ? {}
        : { metadata: { triggeredByAlly: event.metadata.triggeredByAlly } })
    })
  });
  context.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'skill',
      name: 'Splinter Weapon',
      at: event.at,
      sourceSkill: event.skillName,
      detail: '',
      icon: spellIcon(context, ID.SPLINTER_WEAPON)
    }
  });
}

// Spend eligible recipients' weapon-spell charges when their damaging strikes resolve.
function reactToDamage(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;
  // Splinter damage belongs to the caster even when an ally triggers it, so it spends the caster's Nightmare charges.
  // Other derived damage cannot chain weapon spells, and Nightmare's life steal never triggers Splinter.
  if (event.actorType === 'effect') {
    if (event.sourceId === ID.SPLINTER_WEAPON) triggerRitualistWeaponSpell(context, event, 'nightmare', ['player']);
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
  const active = ritualistState.from(context).weaponSpells[spell];
  if (!active) return;
  const definition = requireBalanceProfileFromContext(
    context,
    spell === 'nightmare' ? PROFILE.nightmareWeaponProc : PROFILE.splinterWeaponProc
  );
  // A removed proc retains its charges; the surviving component of Nightmare can still consume one.
  const hasOutput =
    requireEffect(definition, 'strike', 'Strike') !== undefined ||
    (spell === 'nightmare' && requireEffect(definition, 'condition', 'Vulnerability') !== undefined);
  if (!hasOutput) return;
  const internalCooldown = balanceProfileNumber(definition, 'internalCooldown');
  for (const key of keys) {
    if (!consumeCharge(active.recipients?.[key], event.at, internalCooldown)) continue;
    if (spell === 'nightmare')
      queueNightmareWeapon(context, event, definition, key === 'player' ? 'personal' : 'shared');
    else queueSplinterWeapon(context, event, definition);
  }
}

/** Exposes Ritualist's hit-triggered weapon-spell reaction. */
export const ritualistResolverEventReactions = Object.freeze({
  damage: reactToDamage
});
