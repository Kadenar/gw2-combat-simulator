import { requireBalanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

export function hasLegend(runtime: RevenantRuntime, legendId: string): boolean {
  return runtime.profession.core.selectedLegendIds.includes(legendId);
}

/** Numinous Gift grants its base and equipped-legend boons to the caster or, with Found Purpose, to allies. */
export function numinousGift(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>, allies = false): void {
  if (runtime.config.specialization !== 'Conduit') return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.numinousGift);
  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: profile.effects?.filter(
      (effect) => effect.type === 'boon' && (!effect.metadata?.legendId || hasLegend(runtime, effect.metadata.legendId))
    ),
    attribution: {
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    },
    transform: (event) => ({
      ...event,
      name: cast.skill.name + ' \u2014 ' + event.kind,
      audience: { recipients: allies ? 'party' : 'self' }
    })
  });
}
