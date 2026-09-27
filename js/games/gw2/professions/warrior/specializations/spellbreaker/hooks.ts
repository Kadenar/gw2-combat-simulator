import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';
import {
  reactToSpellbreakerControl,
  reactToSpellbreakerDamage
} from '#gw2/professions/warrior/specializations/spellbreaker/traits/index.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorRuntimeState } from '#gw2/professions/warrior/types.js';

/** Core owns packet execution and one-bar spending; this slice owns accepted control and burst reactions. */
export const spellbreakerHooks: Partial<RuntimeProfession<WarriorRuntimeState>> = {
  initialize(runtime) {
    const core = runtime.profession.core;
    core.maximumAdrenaline = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.resources),
      'maximumStacks'
    );
    core.adrenaline = Math.min(core.adrenaline, core.maximumAdrenaline);
  },
  // Queue No Escape from accepted player control; Insight still updates before the condition resolves.
  traitTriggers: [
    {
      on: 'control.resolved',
      trait: TRAIT.NO_ESCAPE,
      emit: PROFILE.noEscape,
      when: (_runtime, event) =>
        event.actorType === 'player' && ['daze', 'stun'].includes(String(event.controlKind).toLowerCase()),
      effects: (effect) => effect.type === 'condition' && effect.name === 'Immobilized',
      attribution: { source: 'Trait', sourceId: TRAIT.NO_ESCAPE, actorType: 'effect', name: 'No Escape - Immobilized' }
    }
  ],
  reactions: {
    'control.resolved': reactToSpellbreakerControl,
    // The resolver checks committed recharge before admitting each tether opportunity.
    'damage.resolved': reactToSpellbreakerDamage
  }
};
