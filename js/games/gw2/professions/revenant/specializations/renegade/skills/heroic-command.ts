import { fervorProfile } from '#gw2/professions/revenant/specializations/renegade/traits/fervor.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { balanceProfileNumber, effectNumber, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { activeKallasFervorStacks } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { heroicCommandProfile } from '#gw2/professions/revenant/specializations/renegade/traits/behavior.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Heroic Command refreshes every started Fervor stack and grants Might scaled by the active count. */
export function heroicCommand(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const state = renegadeState.from(runtime);
  const profile = fervorProfile(runtime);
  const fervor = requireEffect(profile, 'buff', 'kallas-fervor');
  if (!fervor) return;
  const maximum = Math.max(1, balanceProfileNumber(profile, 'maximumStacks'));
  state.kallasFervorMaximumStacks = maximum;
  state.kallasFervor = state.kallasFervor.filter((application) => application.expiresAt > runtime.time);
  const duration = Math.max(0, effectNumber(profile, fervor, 'duration'));
  for (const application of state.kallasFervor)
    if (application.at <= runtime.time) application.expiresAt = runtime.time + duration;
  const stacks = activeKallasFervorStacks(state, runtime.time, maximum);
  if (!stacks) return;
  const source = heroicCommandProfile(runtime, cast);
  const might = requireEffect(source, 'boon', 'might');
  if (!might) return;
  runtime.effects.emit({
    kind: 'profile',
    profile: source,
    at: cast.start,
    fullEnd: runtime.time,
    effects: [{ ...might, stacks: Math.max(1, effectNumber(source, might, 'stacks')) * stacks }],
    attribution: (effect) => ({
      activationId: cast.id,
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: effect.actorType || 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name
    }),
    skillWeaponFallback: 'Unequipped',
    cause: null
  });
}
