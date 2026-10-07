import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import { CAST_READY, denyCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { lockTransitionInput } from '#gw2/platform/execution/transition-lockouts.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { resetSoldierFocus } from '#gw2/professions/warrior/core/traits/tactics.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import { gunsaberEntryTraits } from '#gw2/professions/warrior/specializations/bladesworn/traits/behavior.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;
/** Both sides share the already committed recharge and notify equipment without changing the configured weapon set. */
export function swapGunsaber(runtime: Runtime, cast: RuntimeCast<WarriorSkill>, active: boolean): void {
  bladeswornState.from(runtime).gunsaberActive = active;
  // Every actual Gunsaber entry or exit shares weapon-swap recovery, including entry through Dragon Trigger.
  lockTransitionInput(runtime, 'weaponSwapMs', cast.skill);
  resetAutoattackChains(runtime);
  resetSoldierFocus(runtime);
  const swapId = cast.skill.id === ID.DRAGON_TRIGGER ? ID.UNSHEATHE_GUNSABER : cast.skill.id;
  if (cast.skill.id === ID.DRAGON_TRIGGER)
    runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(ID.UNSHEATHE_GUNSABER)!, runtime.time);
  runtime.cooldownController.copy(swapId, ID.UNSHEATHE_GUNSABER);
  runtime.cooldownController.copy(swapId, ID.SHEATHE_GUNSABER);
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'sigil_swap',
      at: runtime.time,
      source: 'warrior',
      sourceId: cast.skill.id,
      actorType: 'player',
      activationId: cast.id,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      weaponSet: runtime.activeWeaponSet
    }
  });
  if (active) gunsaberEntryTraits(runtime, cast);
}

/** Bar replacement and explicit transition eligibility precede charge-specific readiness. */
export function gunsaberBarAvailability(runtime: MechanicQueriesOf<Runtime>, skill: WarriorSkill) {
  const state = bladeswornState.from(runtime);
  // Equipment changes require returning to the normal bar, even before combat begins.
  if (skill.inputCategory === 'weapon-swap' && (state.gunsaberActive || state.dragonTriggerActive))
    return denyCast('warrior.gunsaber', 'Sheathe the gunsaber before swapping weapon sets.');
  if (skill.burst && !skill.dragonSlash)
    return denyCast('warrior.flow', 'Bladesworn replaces weapon bursts with Dragon Slash.');
  if (skill.id === ID.UNSHEATHE_GUNSABER && state.gunsaberActive)
    return denyCast('warrior.gunsaber', 'Gunsaber is already active.');
  if (skill.id === ID.SHEATHE_GUNSABER && !state.gunsaberActive)
    return denyCast('warrior.gunsaber', 'Gunsaber is not active.');
  if ((state.gunsaberActive || state.dragonTriggerActive) && skill.type === 'Weapon' && skill.weapon)
    return denyCast('warrior.gunsaber', 'Sheathe the gunsaber before using standard weapon skills.');
  return CAST_READY;
}

/** Attack eligibility follows Trigger readiness so existing denial precedence stays stable. */
export function gunsaberAttackAvailability(runtime: MechanicQueriesOf<Runtime>, skill: WarriorSkill) {
  const state = bladeswornState.from(runtime);
  if (skill.gunsaberSkill && !skill.dragonSlash && !skill.dragonTriggerSkill) {
    if (state.dragonTriggerActive)
      return denyCast('warrior.dragon-trigger', 'Finish Dragon Trigger before using gunsaber attacks.');
    if (!state.gunsaberActive) return denyCast('warrior.gunsaber', 'Unsheathe the gunsaber first.');
  }

  return CAST_READY;
}
