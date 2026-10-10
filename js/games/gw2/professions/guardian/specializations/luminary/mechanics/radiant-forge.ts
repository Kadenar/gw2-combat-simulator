import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';
import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { lockTransitionInput } from '#gw2/platform/execution/transition-lockouts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

export const EXIT = 'guardian.luminary.forge-expiry';

export const EQUIP = 'guardian.luminary.equip-traits';

export const equipForge = new WeakMap<RuntimeCast<GuardianSkill>, string | null>();

/** Forge exits start real recharge once, using distinct completed weapon equips and the shared rate controller. */
export function exitForge(runtime: Runtime, cast?: RuntimeCast<GuardianSkill>): void {
  const state = luminaryState.from(runtime);
  if (!state.radiantForge) return;
  const enter = runtime.helpers.skillsById.get(ID.ENTER_RADIANT_FORGE)!;
  const exit = runtime.helpers.skillsById.get(ID.EXIT_RADIANT_FORGE)!;
  if (
    runtime.hasExplicitCombatStart &&
    (runtime.combatStartPending ||
      runtime.castController.pendingCombatStart() ||
      runtime.combatStartTime == null ||
      runtime.time < runtime.combatStartTime)
  )
    runtime.cooldownController.clear(enter.id);
  else {
    const used = Object.keys(state.radiantWeaponsUsed).filter((weapon) =>
      ['hammer', 'staff', 'blade', 'bulwark'].includes(weapon)
    ).length;
    const reduction =
      used <= 1
        ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.forge), 'rechargeReduction')
        : 0;
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
      actorType: 'player',
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
export function enterForge(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): void {
  runtime.cooldownController.clear(cast.skill.id);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.forge);
  const effect = requireEffect(profile, 'buff', 'radiant-forge');
  if (!effect) return;
  const state = luminaryState.from(runtime);
  state.radiantForge = true;
  state.radiantForgeEndsAt = canonicalTime(runtime.time + effectNumber(profile, effect, 'duration'));
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
