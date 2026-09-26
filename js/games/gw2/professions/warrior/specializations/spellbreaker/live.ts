import { canonicalTime } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';
import { spellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import {
  reactToSpellbreakerControl,
  reactToSpellbreakerDamage
} from '#gw2/professions/warrior/specializations/spellbreaker/traits/index.js';
import type { Gw2Runtime, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorRuntimeState } from '#gw2/professions/warrior/types.js';

type Runtime = Gw2Runtime<WarriorRuntimeState>;
const INSIGHT_EXPIRY = 'warrior.attackers-insight-expiry';
const TETHER_EXPIRY = 'warrior.magebane-tether-expiry';

/** Schedule only the earliest surviving stack boundary; an obsolete wake cannot consume a refreshed grant. */
function scheduleInsightExpiry(runtime: Runtime): void {
  const state = spellbreakerState.from(runtime);
  state.attackerInsightExpiries = state.attackerInsightExpiries.map(canonicalTime);
  if (state.attackerInsightExpiries.length) {
    const at = Math.min(...state.attackerInsightExpiries);
    runtime.schedule(INSIGHT_EXPIRY, at, at, undefined, -220);
  }
}

/** Core owns packet execution and one-bar spending; this slice owns accepted control and burst reactions. */
export const spellbreakerLiveMechanics: Partial<RuntimeProfession<WarriorRuntimeState>> = {
  initialize(runtime) {
    const core = runtime.profession.core;
    core.maximumAdrenaline = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.resources),
      'maximumStacks'
    );
    core.adrenaline = Math.min(core.adrenaline, core.maximumAdrenaline);
  },
  reactions: {
    'control.resolved'(runtime, event) {
      if (event.actorType !== 'player') return;
      reactToSpellbreakerControl(runtime, event);
      scheduleInsightExpiry(runtime);
      if (!hasTrait(runtime, TRAIT.NO_ESCAPE) || !['daze', 'stun'].includes(String(event.controlKind).toLowerCase()))
        return;
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.noEscape);
      const effect = requireEffect(profile, 'condition', 'Immobilized');
      if (effect)
        runtime.emitDerived(
          event,
          buildResolverCondition({
            at: runtime.time,
            source: 'Trait',
            sourceId: TRAIT.NO_ESCAPE,
            actorType: 'effect',
            skillId: event.skillId,
            skillName: event.skillName,
            name: 'No Escape - Immobilized',
            condition: 'Immobilized',
            stacks: effectNumber(profile, effect, 'stacks'),
            duration: effectNumber(profile, effect, 'duration')
          })
        );
    },
    'damage.resolved'(runtime, event) {
      const state = spellbreakerState.from(runtime);
      const previous = state.magebaneTetherUntil;
      // The existing resolver helper reprojects recharge from actual Alacrity before admitting each opportunity.
      reactToSpellbreakerDamage(runtime, event);
      if (state.magebaneTetherUntil !== previous) {
        state.magebaneTetherUntil = canonicalTime(state.magebaneTetherUntil);
        if (state.magebaneTetherUntil > runtime.time)
          runtime.schedule(TETHER_EXPIRY, state.magebaneTetherUntil, state.magebaneTetherUntil, undefined, -220);
      }
    }
  },
  tasks: {
    [INSIGHT_EXPIRY](runtime, deadline) {
      const state = spellbreakerState.from(runtime);
      if (Math.min(...state.attackerInsightExpiries) !== deadline) return;
      state.attackerInsightExpiries = purgeExpiredStacks(state.attackerInsightExpiries, runtime.time);
      scheduleInsightExpiry(runtime);
    },
    [TETHER_EXPIRY](runtime, deadline) {
      const state = spellbreakerState.from(runtime);
      if (state.magebaneTetherUntil === deadline) state.magebaneTetherUntil = 0;
    }
  }
};
