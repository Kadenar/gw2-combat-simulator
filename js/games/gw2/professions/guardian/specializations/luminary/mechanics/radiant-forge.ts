import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { requireBalanceNumber } from '#gw2/platform/effects/validation.js';
import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { CAST_READY, denyCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { lockTransitionInput } from '#gw2/platform/execution/transition-lockouts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { effectNumber, requireEffect, requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { radiantWeaponEquipped } from '#gw2/professions/guardian/specializations/luminary/mechanics/trigger-points.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianRuntime, GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const EXIT = 'guardian.luminary.forge-expiry';

const EQUIP = 'guardian.luminary.equip-traits';

const equipForge = new WeakMap<RuntimeCast<GuardianSkill>, string | null>();

/** Forge exits start real recharge once, using distinct completed weapon equips and the shared rate controller. */
function exitForge(runtime: GuardianRuntime, cast?: RuntimeCast<GuardianSkill>): void {
  const state = luminaryState.from(runtime);

  if (!state.radiantForge) return;

  const enter = runtime.helpers.skillsById.get(ID.ENTER_RADIANT_FORGE)!;
  const exit = runtime.helpers.skillsById.get(ID.EXIT_RADIANT_FORGE)!;

  if (!runtime.engagement.preparationComplete()) runtime.cooldownController.clear(enter.id);
  else {
    const used = Object.keys(state.radiantWeaponsUsed).filter((weapon) =>
      ['hammer', 'staff', 'blade', 'bulwark'].includes(weapon)
    ).length;
    // Entry owns the selected recharge adjustment even when expiry initiates the exit.
    const reduction =
      used <= 1 ? requireBalanceNumber(enter.rechargeReduction, `skill=${enter.id} field=rechargeReduction`) : 0;
    // Forge entry is a fourth profession action, outside weapon and virtue recharge traits.
    const work = Math.max(0, gw2BaseRecharge(enter) - reduction);
    runtime.cooldownController.startRecharge(enter, runtime.time, work);
  }

  state.radiantForge = false;
  state.radiantForgeEndsAt = 0;
  state.forgeActivationId = null;
  state.radiantWeapon = '';
  state.glaringBurstSwordSlow = false;
  resetAutoattackChains(runtime);
  // Leaving the forge dismisses only its own bar; ordinary weapon follow-ups retain their independent lifetimes.
  for (const id of Object.keys(runtime.profession.core.availableFlips)) {
    const skill = runtime.helpers.skillsById.get(Number(id));

    if (skill?.radiantForgeSkill || skill?.id === ID.EXIT_RADIANT_FORGE)
      consumeSkillFlip(runtime.profession.core.availableFlips, id);
  }

  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'weapon_set',
      at: runtime.time,
      source: 'guardian',
      sourceId: exit.id,
      actorType: ACTOR.PLAYER,
      skillId: exit.id,
      skillName: exit.name,
      weaponSet: runtime.activeWeaponSet,
      weaponLine: exit.name,
      activationId: cast?.id,
      automatic: !cast
    }
  });
  lockTransitionInput(runtime, 'forgeExitMs', exit);
}

/** The form has one exact expiry; a stale expiry cannot close a later entry at the same deadline. */
function enterForge(runtime: GuardianRuntime, cast: RuntimeCast<GuardianSkill>): void {
  runtime.cooldownController.clear(cast.skill.id);
  const skill = requireSkillFromContext(runtime, ID.ENTER_RADIANT_FORGE);
  const effect = requireEffect(skill, 'buff', 'radiant-forge');

  if (!effect) return;

  const state = luminaryState.from(runtime);
  state.radiantForge = true;
  state.radiantForgeEndsAt = canonicalTime(runtime.time + effectNumber(skill, effect, 'duration'));
  state.forgeActivationId = cast.id;
  state.radiantWeapon = '';
  state.glaringBurstSwordSlow = false;
  state.radiantWeaponsUsed = {};
  resetAutoattackChains(runtime);
  armSkillFlip(runtime.profession.core.availableFlips, ID.EXIT_RADIANT_FORGE, runtime.time);
  runtime.schedule(EXIT, state.radiantForgeEndsAt, cast.id, undefined, -220);
  runtime.effects.emit({
    kind: 'packet',
    event: {
      ...guardianCastCause(runtime, cast),
      type: 'weapon_set',
      weaponSet: runtime.activeWeaponSet,
      weaponLine: cast.skill.name
    }
  });
  lockTransitionInput(runtime, 'forgeEntryMs', cast.skill);
}

/** Declarations select these actions; their state transitions stay with the mechanic owner. */
const radiantForgeActions: NonNullable<RuntimeHooks<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers']> = {
  // Form transitions share expiry/recharge ownership; declarations choose when to invoke them.
  'guardian.enter-forge'(runtime, context) {
    if (context.kind === 'cast') enterForge(runtime, context.cast);
  },
  'guardian.exit-forge'(runtime, context) {
    if (context.kind === 'cast') exitForge(runtime, context.cast);
  },
  'guardian.snapshot-forge'(runtime, context) {
    if (context.kind === 'cast') equipForge.set(context.cast, luminaryState.from(runtime).forgeActivationId);
  },
  'guardian.equip-forge'(runtime, context) {
    if (context.kind !== 'cast') return;

    const cast = context.cast;
    const state = luminaryState.from(runtime);

    if (state.radiantForge && equipForge.get(cast) === state.forgeActivationId) {
      state.radiantWeapon = String(cast.skill.radiantWeapon);
      state.radiantWeaponsUsed[String(cast.skill.radiantWeapon)] = true;

      if (cast.skill.radiantWeapon === 'blade') state.glaringBurstSwordSlow = false;

      const flips = runtime.profession.core.availableFlips;
      for (const id of Object.keys(flips)) {
        const skill = runtime.helpers.skillsById.get(Number(id));

        if (skill?.radiantWeapon && skill.flipParentId != null) consumeSkillFlip(flips, id);
      }

      if (cast.skill.flipSkillId != null) armSkillFlip(flips, cast.skill.flipSkillId, runtime.time);

      runtime.effects.emit({
        kind: 'packet',
        event: { ...guardianCastCause(runtime, cast), type: 'sigil_swap', weaponSet: runtime.activeWeaponSet }
      });
      // Queue equip rewards after the state transition without adding elapsed combat time.
      runtime.scheduleForCast(EQUIP, runtime.time, cast);
    }
  }
};

/** The live forge form selects the usable bar before any cast can mutate it. */
function radiantForgeAvailability(
  runtime: MechanicQueriesOf<GuardianRuntime>,
  skill: GuardianSkill
): AvailabilityResult {
  const active = luminaryState.from(runtime).radiantForge;

  if (skill.type === 'Weapon' && active)
    return denyCast(
      'guardian.radiant-forge-weapon-lockout',
      `${skill.name} is unavailable — exit Radiant Forge first.`
    );

  if ((skill.radiantForgeSkill || skill.id === ID.EXIT_RADIANT_FORGE) && !active)
    return denyCast('guardian.radiant-forge-inactive', `${skill.name} is unavailable — requires Radiant Forge.`);

  if (skill.id === ID.ENTER_RADIANT_FORGE && active)
    return denyCast('guardian.radiant-forge-active', `${skill.name} is unavailable — Radiant Forge is already active.`);

  return CAST_READY;
}

/** Keep scheduled work with the state and generation that own its lifetime. */
const radiantForgeTasks: NonNullable<RuntimeHooks<GuardianRuntimeState, GuardianSkill>['tasks']> = {
  [EXIT](runtime, data) {
    if (luminaryState.from(runtime).forgeActivationId === data) exitForge(runtime);
  },
  // Same-time equip rewards retain boon, armament, then recharge ordering.
  [EQUIP]: (runtime, data) =>
    runtime.fireTrigger(radiantWeaponEquipped, { cast: (data as { cast: RuntimeCast<GuardianSkill> }).cast })
};

/** Radiant Forge transitions, availability, and their expiry and equip tasks share one owner. */
export const radiantForgeLifecycle = {
  sideEffectHandlers: radiantForgeActions,
  tasks: radiantForgeTasks,
  availability: radiantForgeAvailability
} satisfies RuntimeHooks<GuardianRuntimeState, GuardianSkill>;
