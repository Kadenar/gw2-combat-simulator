import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
/** Fireworks relic rules. */
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic, timedStrikeBuff, recordTimedBuffProc } from '#gw2/platform/equipment/relics/rules/shared.js';

export const fireworks = defineRelic({
  buffPolicies: [{ kind: 'relic-fireworks', name: 'Relic of Fireworks', maximumStacks: 1 }],
  precombatStrike(ctx, state, event, skill) {
    // Non-damaging strikes such as Updraft can prepare Fireworks without dealing damage or entering combat.
    // The normal eligibility check still excludes flat damage, allies, bundles, and short-recharge skills.
    if (event.coefficient === 0 && event.damageKind !== 'condition') fireworks.afterHit?.(ctx, state, event, skill);
  },
  afterHit(ctx, _state, event, skill) {
    // Flat strikes (including Binding Blade's tether) ignore weapon strength and cannot activate Fireworks.
    const isFlatStrike =
      event.type === 'damage' &&
      [event.flatDamage, event.flatStrikeBase, event.flatStrikePowerCoeff].some(Number.isFinite);
    // Kit/bundle skills strike at bundle strength rather than weapon
    // strength, so they never qualify.
    const isWeaponSkill = skill?.type === 'Weapon' && !skill.kitId;
    // Profession-mechanic skills qualify when they strike at weapon strength:
    // either an equipped weapon profile or the dedicated profession-mechanic
    // profile. Bundle strength and unequipped utility strength do not count.
    const profileId = event.weaponStrengthProfileId || '';
    const strikesAtWeaponStrength = profileId.startsWith('weapon.') || profileId === 'nonweapon.profession-mechanic';
    const isWeaponStrengthProfessionMechanic = event.skillWeapon === 'Profession mechanic' || strikesAtWeaponStrength;

    if (
      isFlatStrike ||
      !isGw2PlayerActorEvent(event) ||
      (!isWeaponSkill && !skill?.shroud && !isWeaponStrengthProfessionMechanic) ||
      (skill?.cooldown || 0) < 20
    ) {
      return;
    }

    recordTimedBuffProc(ctx, event, {
      relicId: RELIC_IDS.FIREWORKS,
      kind: 'relic-fireworks',
      duration: 6,
      name: 'Relic of Fireworks'
    });
  },
  strikeMultiplier: timedStrikeBuff('relic-fireworks', 1.07)
});
