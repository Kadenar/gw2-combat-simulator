import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext as damageProfile,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import { necromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/resources.js';
import { NECROMANCER_SKILL_IDS as DAMAGE_SKILL } from '#gw2/professions/necromancer/data/ids.js';
import { ritualistBuffPolicies } from '#gw2/professions/necromancer/specializations/ritualist/effect-state.js';
import {
  emitPainfulBond,
  ritualistSpellHooks
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spells.js';
import {
  queueNightmareWeapon,
  queueSplinterWeapon
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-effects.js';
import {
  initializeRitualistSpiritLifecycle,
  startRitualistSpirits,
  ritualistSpiritTasks
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-lifecycle.js';
import {
  RITUALIST_BALANCE_PROFILE_IDS as DAMAGE_PROFILE,
  RITUALIST_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import {
  INNERVATE,
  ritualistSpiritActions
} from '#gw2/professions/necromancer/specializations/ritualist/skills/spirit-actions.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import {
  initializeRitualistSummonTraits,
  lingeringSpiritsActive
} from '#gw2/professions/necromancer/specializations/ritualist/traits/behavior.js';
import type { NecromancerRuntimeState, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Ritualist uses the shared Core resource owner and actual creature callbacks, with specialization-owned lifetimes. */
const spiritLifecycle: RuntimeHooks<NecromancerRuntimeState, NecromancerSkill> = {
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
        queueNightmareWeapon(
          runtime,
          damageInputEvent(runtime),
          damageProfile(runtime, DAMAGE_PROFILE.nightmareWeaponProc),
          'personal'
        )
    },
    {
      id: 'splinter-weapon',
      name: 'Splinter Weapon',
      source: 'Profession',
      unit: 'charge',
      sourceIds: [DAMAGE_SKILL.SPLINTER_WEAPON],
      emit: (runtime) =>
        queueSplinterWeapon(
          runtime,
          damageInputEvent(runtime),
          damageProfile(runtime, DAMAGE_PROFILE.splinterWeaponProc)
        )
    }
  ],

  // Recipient pools already own replacement and charge consumption; publish their retained grants directly.
  buffPolicies: ritualistBuffPolicies,
  observeEffects(runtime) {
    return Object.entries(ritualistState.from(runtime).weaponSpells).flatMap(([spell, state]) =>
      Object.entries(state.recipients ?? {}).map(([recipient, grant]) =>
        timedEffectState(spell + '-weapon', [{ stacks: grant.charges, expiresAt: grant.expiresAt }], null, {
          recipient:
            recipient === 'player' ? 'self' : recipient.startsWith('ally:') ? recipient : 'companion:' + recipient
        })
      )
    );
  },
  resources: {
    lifeForce: {
      ...necromancerLifeForce,
      recovery(runtime) {
        if (
          !runtime.profession.core.activeShroud &&
          Object.keys(ritualistState.from(runtime).activeSpirits).length &&
          lingeringSpiritsActive(runtime)
        )
          return (
            (-runtime.profession.core.lifeForce.maximum *
              balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'lifeForceDrain')) /
            100
          );
        return necromancerLifeForce.recovery(runtime);
      }
    }
  },
  onCombatStart: startRitualistSpirits,
  initialize(runtime) {
    initializeRitualistSpiritLifecycle(runtime);
    initializeRitualistSummonTraits(runtime);
  },
  availability(runtime, skill) {
    const key = INNERVATE.get(skill.id);
    return key && !ritualistState.from(runtime).activeSpirits[key]
      ? denySkillCast(skill, 'necromancer.spirit', `requires an active ${key} spirit.`)
      : { ready: true };
  },
  sideEffectHandlers: ritualistSpiritActions,
  tasks: ritualistSpiritTasks
};

/** Compose independent weapon-spell and spirit owners without hiding duplicate registries. */
export const ritualistHooks = composeRuntimeHooks<NecromancerRuntimeState, NecromancerSkill>([
  ritualistSpellHooks,
  spiritLifecycle
]);
