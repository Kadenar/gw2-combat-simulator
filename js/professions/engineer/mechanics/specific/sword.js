function reduceCooldown(context, skill, seconds, at) {
  if (context.state.ammo.get(skill.id)) {
    return context.cooldownController.reduceAmmoRecharge(
      skill,
      seconds,
      at,
    ).reducedBy;
  }
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  if (readyAt <= at + context.epsilon) return 0;
  const reducedBy = Math.min(seconds, readyAt - at);
  context.state.cooldowns.set(skill.id, readyAt - reducedBy);
  return reducedBy;
}

export function rechargeOtherSwordSkills(context, gleamSaber) {
  const at = context.effectiveEnd;
  const activeIds = new Set([
    ...context.state.cooldowns.keys(),
    ...context.state.ammo.keys(),
  ]);
  let reducedBy = 0;
  for (const skillId of activeIds) {
    const skill = context.catalog.skillsById.get(skillId);
    if (
      skill?.type === "Weapon"
      && skill.weapon === "Sword"
      && skill.id !== gleamSaber.id
    ) {
      reducedBy += reduceCooldown(context, skill, 1, at);
    }
  }
  if (reducedBy <= 0) return;
  context.emit({
    type: "proc",
    at,
    source: "engineer",
    sourceId: gleamSaber.id,
    actorType: "player",
    name: "Gleam Saber — Sword Recharge",
    procType: "skill",
    sourceSkill: gleamSaber.name,
    cooldownReduction: reducedBy,
  });
}
