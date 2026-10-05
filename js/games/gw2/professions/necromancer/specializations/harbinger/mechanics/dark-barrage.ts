import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { balanceProfileNumber, effectNumber } from '#gw2/platform/skills/balance-profiles.js';

/** Doom Approaches repeats only strikes and conditions; combat and tooltips consume the same selected volley. */
export function darkBarrageEffects(profile: BalanceProfile, effects: readonly SkillEffect[]): SkillEffect[] {
  const ticks = Array.from({ length: balanceProfileNumber(profile, 'pulseCount') }, (_, index) => ({
    atMs: (index + 1) * balanceProfileNumber(profile, 'pulseInterval') * 1000
  }));
  // An empty volley must not become an untimed application when passed to the ordinary effect expander.
  if (!ticks.length) return [];
  return effects.flatMap((effect): SkillEffect[] => {
    if (effect.type === 'strike')
      return [
        {
          ...effect,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          ticks: ticks.map((tick) => ({ ...tick, coefficient: effectNumber(profile, effect, 'coefficient') }))
        }
      ];
    if (effect.type === 'condition')
      return [
        {
          ...effect,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          ticks: ticks.map((tick) => ({
            ...tick,
            condition: String(effect.condition),
            stacks: effectNumber(profile, effect, 'stacks'),
            duration: effectNumber(profile, effect, 'duration')
          }))
        }
      ];
    return [];
  });
}
