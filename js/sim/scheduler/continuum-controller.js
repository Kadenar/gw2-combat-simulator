/**
 * Owns Continuum Split snapshots and restoration.
 */
export function createContinuumController({
  state,
  unaffectedCooldownIds,
  epsilon,
  skillsById,
  refreshAmmo,
  consumeResources,
  triggerShatterTraits,
  addEvent,
}) {
  const restoreContinuum = (at, reason) => {
    if (!state.continuum) return;
    const splitReady = state.continuum.splitReady;
    const unaffectedCooldowns = [...state.cooldowns]
      .filter(([id]) => unaffectedCooldownIds.has(id));
    state.cooldowns = new Map([
      ...unaffectedCooldowns,
      ...[...state.continuum.remainingCooldowns]
        .filter(([, remaining]) => remaining > epsilon)
        .map(([id, remaining]) => [id, at + remaining]),
    ]);
    if (splitReady) state.cooldowns.set(state.continuum.splitId, splitReady);
    state.ammo = new Map(
      [...state.continuum.ammo].map(([id, ammo]) => [
        id,
        {
          ...ammo,
          nextRechargeAt:
            ammo.nextRechargeRemaining == null
              ? null
              : at + ammo.nextRechargeRemaining,
        },
      ]),
    );
    state.autoattackChains = new Map(state.continuum.autoattackChains || []);
    for (const [id] of state.ammo) {
      const ammoSkill = skillsById.get(id);
      if (ammoSkill) refreshAmmo(ammoSkill, at);
    }
    addEvent({
      type: "marker",
      at,
      name: "Continuum Shift",
      detail: reason,
    });
    addEvent({
      type: "cooldown_snapshot",
      at,
      cooldowns: Object.fromEntries(state.cooldowns),
    });
    state.continuum = null;
  };

  const beginContinuumSplit = (skill, at) => {
    const spent = consumeResources(at);
    const remainingCooldowns = new Map(
      [...state.cooldowns]
        .filter(([id]) =>
          id !== skill.id && !unaffectedCooldownIds.has(id))
        .map(([id, ready]) => [id, ready - at]),
    );
    const ammo = new Map(
      [...state.ammo].map(([id, value]) => [
        id,
        {
          charges: value.charges,
          maximum: value.maximum,
          rechargeDuration: value.rechargeDuration,
          nextRechargeRemaining:
            value.nextRechargeAt == null
              ? null
              : Math.max(0, value.nextRechargeAt - at),
        },
      ]),
    );
    state.continuum = {
      splitId: skill.id,
      splitReady: state.cooldowns.get(skill.id),
      remainingCooldowns,
      ammo,
      autoattackChains: new Map(state.autoattackChains),
      expiresAt: at + 1.5 * (spent + 1),
    };
    triggerShatterTraits(skill, at, spent, false);
    addEvent({
      type: "marker",
      at,
      name: "Continuum Split",
      detail: `${(1.5 * (spent + 1)).toFixed(1)}s window`,
    });
  };

  return {
    beginContinuumSplit,
    restoreContinuum,
  };
}
