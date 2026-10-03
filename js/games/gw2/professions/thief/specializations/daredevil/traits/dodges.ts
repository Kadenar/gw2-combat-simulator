import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { BalanceProfile, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefBuff } from '#gw2/professions/thief/core/events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { daredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';
import type { ThiefConfig, ThiefDodge, ThiefSkill } from '#gw2/professions/thief/types.js';

// The dodge choice retains trait attribution while its balance profile owns every emitted packet.
export const DODGE_PROFILES: Readonly<Partial<Record<ThiefDodge, SkillId>>> = Object.freeze({
  'Bounding Dodger': TRAIT.BOUNDING_DODGER,
  'Lotus Training': TRAIT.LOTUS_TRAINING,
  'Unhindered Combatant': TRAIT.UNHINDERED_COMBATANT
});

export function selectedDodgeProfile(runtime: ThiefRuntime): BalanceProfile | undefined {
  const profileId = DODGE_PROFILES[daredevilState.from(runtime).selectedDodge];
  return profileId == null ? undefined : requireBalanceProfileFromContext(runtime, profileId);
}

/** Dodge packets use the in-game skill name of the selected dodge. */
export function dodgeSkillName(runtime: ThiefRuntime): string {
  const selected = daredevilState.from(runtime).selectedDodge;
  return selected === 'Bounding Dodger' ? 'Bound' : selected === 'Lotus Training' ? 'Impaling Lotus' : selected;
}

/**
 * A committed dodge queues its selected profile's packets at acceptance, at their authored offsets or at completion,
 * so a strike before the dodge finishes still lands at its own instant.
 */
export function queueDodgePackets(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const profile = selectedDodgeProfile(runtime);
  if (!profile) return;
  const skill = cast.skill;
  const name = dodgeSkillName(runtime);
  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: profile.effects?.map((effect) => ({ timingAnchor: 'castStart' as const, ...effect })),
    at: cast.start,
    fullEnd: cast.effectiveEnd,
    skillWeaponFallback: 'Unequipped',
    attribution: (effect) => ({
      source: effect.type === 'strike' ? 'thief' : 'Trait',
      sourceId: profile.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: name,
      activationId: cast.id
    }),
    transform: (event, effect) => ({
      ...event,
      icon: runtime.helpers.skillsByName.get(name)?.icon,
      name:
        effect.type === 'condition'
          ? `${name} — ${effect.condition}`
          : effect.type === 'boon'
            ? `${name} — ${effect.boon}`
            : name
    })
  });
}

/**
 * A committed dodge opens its damage window after the dodge's own same-instant packets, so its landing strike (Bound)
 * resolves before the window it grants.
 */
export function openDodgeWindow(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const state = daredevilState.from(runtime);
  const profile = selectedDodgeProfile(runtime);
  if (profile && state.selectedDodge === 'Bounding Dodger')
    state.boundingDamageUntil = runtime.time + balanceProfileNumber(profile, 'durationMultiplier');
  if (profile && state.selectedDodge === 'Lotus Training') {
    const duration = balanceProfileNumber(profile, 'durationMultiplier');
    state.lotusConditionDamageUntil = runtime.time + duration;
    // Expose the same timed window used by damage modifiers as a visible buff.
    runtime.effects.emit({
      kind: 'packet',
      event: buildThiefBuff(cast.skill, {
        at: runtime.time,
        source: 'Trait',
        sourceId: TRAIT.LOTUS_TRAINING,
        activationId: cast.id,
        kind: 'lotus-training',
        duration
      })
    });
  }
}

export function selectedDodge(config: ThiefConfig, traits: ReadonlySet<string | number>): ThiefDodge {
  // Trait-based dodge replaces any explicit config choice; only one Daredevil minor trait can be active
  if (hasTrait(traits, TRAIT.LOTUS_TRAINING)) return 'Lotus Training';
  if (hasTrait(traits, TRAIT.BOUNDING_DODGER)) return 'Bounding Dodger';
  if (hasTrait(traits, TRAIT.UNHINDERED_COMBATANT)) {
    return 'Unhindered Combatant';
  }

  // Fall back to explicit config selection or plain dodge for Core Thief / non-minor builds
  return config.selectedDodge || 'Dodge';
}
