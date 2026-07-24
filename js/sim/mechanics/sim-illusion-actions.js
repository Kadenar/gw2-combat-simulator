/**
 * Creates clone attack scheduler: schedules periodic clone attacks based on weapon.
 * Manages clone attack timing (interval per weapon), damage, conditions.
 * Returns: initializeClone, nextAttackAt, scheduleAt.
 * @param {Object} config - Scheduler config (state, cloneAttacks data, etc.)
 * @returns {Object} Clone attack scheduler
 */
export function createCloneAttackScheduler({
  state,
  cloneAttacks,
  epsilon,
  addDamage,
  addCondition,
}) {
  /** Gets attack pattern for a clone's weapon (defaults to Sword). */
  const attackFor = (clone) =>
    cloneAttacks[clone.weapon] || cloneAttacks.Sword;

  /**
   * Initializes a clone: sets nextAttackAt to creation + first attack interval.
   * @param {Object} clone - Clone object
   * @returns {Object} Initialized clone
   */
  const initializeClone = (clone) => {
    const attack = attackFor(clone);
    clone.nextAttackAt =
      clone.createdAt
      + Number(attack.firstAttackDelay ?? attack.interval);
    return clone;
  };

  /** Returns next attack time across all clones (or Infinity if none). */
  const nextAttackAt = () => {
    let next = Infinity;
    for (const clone of state.clones) {
      next = Math.min(next, clone.nextAttackAt);
    }
    return next;
  };

  /** Schedules a clone attack: adds damage, conditions, advances nextAttackAt by interval. */
  const scheduleAttack = (clone, at) => {
    const attack = attackFor(clone);
    const cloneSkill = {
      name: `${clone.weapon} Clone`,
      weapon: clone.weapon,
      blade: false,
    };
    addDamage(cloneSkill, at, {
      coefficient: attack.coefficient,
      hits: attack.hits,
      source: "Clone",
      weaponStrength: attack.weaponStrength,
    }, {
      cloneId: clone.id,
      source: "Clone",
    });
    for (const condition of attack.conditions || []) {
      addCondition(
        `${clone.weapon} Clone`,
        at,
        condition,
        "Clone",
        "",
        { cloneId: clone.id },
      );
    }
  };

  /**
   * Processes all clones due at time; schedules their attacks, advances nextAttackAt.
   * @param {number} at - Current time
   */
  const scheduleAt = (at) => {
    for (const clone of state.clones) {
      if (clone.nextAttackAt > at + epsilon) continue;
      scheduleAttack(clone, at);
      clone.nextAttackAt += attackFor(clone).interval;
    }
  };

  return {
    initializeClone,
    nextAttackAt,
    scheduleAt,
  };
}
