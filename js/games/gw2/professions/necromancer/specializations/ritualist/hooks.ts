/** Compose spirit execution, player actions, and independent weapon-spell effects through their runtime hooks. */
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { ACTOR, RECIPIENT } from '#gw2/platform/constants.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/input-event.js';
import { balanceNumber, requireSkill as damageSkill } from '#gw2/platform/skills/balance-profiles.js';
import { setNecromancerCreatureStrikeScaling } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import {
  NECROMANCER_SKILL_IDS as DAMAGE_SKILL,
  NECROMANCER_TRAIT_IDS as TRAIT
} from '#gw2/professions/necromancer/data/ids.js';
import { ritualistBuffPolicies } from '#gw2/professions/necromancer/specializations/ritualist/effect-state.js';
import {
  emitPainfulBond,
  ritualistSpellHooks
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spells.js';
import { queueWeaponSpellCharge } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-effects.js';
import { ritualistSpiritHooks } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-lifecycle.js';
import { ritualistPlayerActionHooks } from '#gw2/professions/necromancer/specializations/ritualist/skills/spirit-actions.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import type { NecromancerRuntimeState, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Expose independent effect previews and grants, and apply Ritualist scaling to the shared creature owner. */
const ritualistEffectHooks: RuntimeHooks<NecromancerRuntimeState, NecromancerSkill> = {
  // Each weapon-spell charge is a known effect, independent of who could consume it.
  damageEffects: [
    {
      id: 'ritualist.painful-bond',
      name: 'Painful Bond',
      source: 'Profession',
      unit: 'pulse',
      sourceIds: ['ritualist.painful-bond'],
      emit(runtime) {
        emitPainfulBond(runtime, damageInputEvent(runtime));
      }
    },
    {
      id: 'nightmare-weapon',
      name: 'Nightmare Weapon',
      source: 'Profession',
      unit: 'charge',
      sourceIds: [DAMAGE_SKILL.NIGHTMARE_WEAPON],
      emit: (runtime) =>
        queueWeaponSpellCharge(
          runtime,
          damageInputEvent(runtime),
          damageSkill(runtime.helpers, DAMAGE_SKILL.NIGHTMARE_WEAPON)
        )
    },
    {
      id: 'splinter-weapon',
      name: 'Splinter Weapon',
      source: 'Profession',
      unit: 'charge',
      sourceIds: [DAMAGE_SKILL.SPLINTER_WEAPON],
      emit: (runtime) =>
        queueWeaponSpellCharge(
          runtime,
          damageInputEvent(runtime),
          damageSkill(runtime.helpers, DAMAGE_SKILL.SPLINTER_WEAPON)
        )
    }
  ],

  // Recipient pools already own replacement and charge consumption; publish their retained grants directly.
  buffPolicies: ritualistBuffPolicies,
  observeEffects(runtime) {
    return Object.entries(ritualistState.from(runtime.profession).weaponSpells).flatMap(([spell, state]) =>
      Object.entries(state.recipients).map(([recipient, grant]) =>
        timedEffectState(spell + '-weapon', [{ stacks: grant.count, expiresAt: grant.expiresAt }], null, {
          recipient:
            recipient === ACTOR.PLAYER
              ? RECIPIENT.SELF
              : recipient.startsWith('ally:')
                ? recipient
                : 'companion:' + recipient
        })
      )
    );
  },
  initialize(runtime) {
    // Creatures sample Spirits' Strength when they commit a strike.
    setNecromancerCreatureStrikeScaling(runtime, () =>
      hasTrait(runtime.queries, TRAIT.SPIRITS_STRENGTH)
        ? balanceNumber(runtime.queries.helpers, TRAIT.SPIRITS_STRENGTH, 'damageMultiplier')
        : 1
    );
  }
};

/** Compose independent weapon-spell and spirit owners without hiding duplicate registries. */
export const ritualistHooks = composeRuntimeHooks<NecromancerRuntimeState, NecromancerSkill>([
  ritualistSpellHooks,
  ritualistSpiritHooks,
  ritualistEffectHooks,
  ritualistPlayerActionHooks
]);
