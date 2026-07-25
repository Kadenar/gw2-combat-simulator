export const guardianSkillHandlers = Object.freeze({
  "guardian.weapon-swap": (context, skill) => {
    const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
    context.state.activeWeaponSet = weaponSet;
    context.emit({
      type: "weapon_set",
      at: context.effectiveEnd,
      source: "guardian",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      weaponSet,
    });
    return true;
  },
});
