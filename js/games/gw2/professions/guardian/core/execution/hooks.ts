import { pruneSkillFlips } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  advanceSpearIlluminationState,
  updateSpearIlluminationState
} from '#gw2/professions/guardian/core/mechanics/spear-illumination.js';
import {
  observeGuardianScheduledEvent,
  updateGuardianTraitCastState
} from '#gw2/professions/guardian/core/traits/index.js';
import { updateWeaponCastState } from '#gw2/professions/guardian/core/mechanics/weapon-state.js';

/** Registers the ordered Core Guardian hooks while each behavior stays with its owning concept. */
export const guardianCoreExecutionHooks = Object.freeze({
  advance: Object.freeze([
    {
      id: 'guardian.weapon-state',
      order: 20,
      handler: (context: GuardianSchedulerContext, at: number) =>
        pruneSkillFlips(professionCoreState(context).availableFlips, at)
    },
    {
      id: 'guardian.spear',
      order: 30,
      handler: advanceSpearIlluminationState
    }
  ]),
  afterCast: Object.freeze([
    {
      id: 'guardian.weapon-state',
      order: 10,
      handler: updateWeaponCastState
    },
    {
      id: 'guardian.spear',
      order: 20,
      handler: updateSpearIlluminationState
    },
    {
      id: 'guardian.core-traits',
      order: 30,
      handler: updateGuardianTraitCastState
    }
  ]),
  onEventScheduled: Object.freeze([
    {
      id: 'guardian.traits',
      order: 10,
      handler: observeGuardianScheduledEvent
    }
  ])
});

import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { GuardianSchedulerContext } from '#gw2/professions/guardian/types.js';
