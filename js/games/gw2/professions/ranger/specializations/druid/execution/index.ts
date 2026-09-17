import { applyCelestialAvatarTraits } from '#gw2/professions/ranger/specializations/druid/mechanics/celestial-avatar-rules.js';
import { enterAvatar, leaveAvatar } from '#gw2/professions/ranger/specializations/druid/mechanics/celestial-avatar.js';
import type { RangerCastContext, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Applies Celestial Avatar transitions after the corresponding native cast. */
export const druidSkillHandlers = Object.freeze({
  'ranger.celestial-avatar-enter': {
    mode: 'augment' as const,
    afterEffects: enterAvatar
  },
  'ranger.celestial-avatar-exit': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      leaveAvatar(context, false, context.effectiveEnd, skill);
    }
  },
  'ranger.celestial-avatar-skill': {
    mode: 'augment' as const,
    afterEffects: applyCelestialAvatarTraits
  }
});
