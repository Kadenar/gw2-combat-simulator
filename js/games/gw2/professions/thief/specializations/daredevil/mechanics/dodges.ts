import { ACTOR, BOON_NAMES } from '#gw2/platform/constants.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { requireBalanceProfile } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { daredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/**
 * A committed dodge queues its selected profile's packets at acceptance, at their authored offsets or at completion,
 * so a strike before the dodge finishes still lands at its own instant.
 */
export function queueDodgePackets(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const dodge = daredevilState.from(runtime.profession).selectedDodge;

  if (!dodge) return;

  const skill = cast.skill;
  const { name } = dodge;
  const profile = requireBalanceProfile(runtime.helpers, dodge.traitId);
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
      actorType: ACTOR.PLAYER,
      skillId: skill.id,
      skillName: name,
      activationId: cast.id
    }),
    // The player's dodge strike retains trait attribution for reporting and damage modifiers.
    transform: (event, effect) => ({
      ...event,
      traitId: profile.id,
      ...(effect.type === 'strike' && dodge.directStrike
        ? { metadata: { ...event.metadata, thiefDirectAttack: true } }
        : {}),
      icon: runtime.helpers.skillsById.get(dodge.iconSkillId)?.icon,
      name:
        effect.type === 'condition'
          ? `${name} - ${effect.condition}`
          : effect.type === 'boon'
            ? `${name} - ${BOON_NAMES[effect.boon]}`
            : name
    })
  });
}
