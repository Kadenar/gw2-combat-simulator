/** Fireworks relic rules. */
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic, timedStrikeBuff, recordTimedBuffProc } from '#gw2/platform/equipment/relics/rules/shared.js';

export const fireworks = defineRelic({
  createState: () => ({ buffUntil: 0 }),
  afterHit(ctx, state, event, skill) {
    // Kit/bundle skills strike at bundle strength rather than weapon
    // strength, so they never qualify.
    const isWeaponSkill = skill?.type === 'Weapon' && !skill?.kit;
    // Profession-mechanic skills qualify when they strike at weapon strength:
    // either an equipped weapon profile or the dedicated profession-mechanic
    // profile. Bundle strength and unequipped utility strength do not count.
    const profileId = String(event.weaponStrengthProfileId || '');
    const strikesAtWeaponStrength = profileId.startsWith('weapon.') || profileId === 'nonweapon.profession-mechanic';
    const isWeaponStrengthProfessionMechanic = event.skillWeapon === 'Profession mechanic' || strikesAtWeaponStrength;
    if (
      !isGw2PlayerActorEvent(event) ||
      (!isWeaponSkill && !skill?.shroud && !isWeaponStrengthProfessionMechanic) ||
      Number(skill?.cooldown || 0) < 20
    ) {
      return;
    }

    recordTimedBuffProc(ctx, state, event, {
      duration: 6,
      name: 'Relic of Fireworks'
    });
  },
  strikeMultiplier: timedStrikeBuff(1.07)
});
