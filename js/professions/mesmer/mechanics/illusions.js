/**
 * Schedules task-driven periodic clone attacks based on weapon.
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
  scheduleTask = null,
}) {
  const profession = state.profession || state;
  /** Gets attack pattern for a clone's weapon (defaults to Sword). */
  const attackFor = (clone) =>
    cloneAttacks[clone.weapon] || cloneAttacks.Sword;

  const sequenceStep = (clone, attack) => {
    if (!Array.isArray(attack.sequence) || attack.sequence.length === 0) {
      return attack;
    }
    const index = Number(clone.attackSequenceIndex || 0) % attack.sequence.length;
    return attack.sequence[index];
  };

  /**
   * Initializes a clone: sets nextAttackAt to creation + first attack interval.
   * @param {Object} clone - Clone object
   * @returns {Object} Initialized clone
   */
  const initializeClone = (clone) => {
    const attack = attackFor(clone);
    clone.ownerId ||= `mesmer.clone:${clone.id}`;
    clone.attackSequenceIndex = 0;
    const step = sequenceStep(clone, attack);
    clone.nextAttackAt =
      clone.createdAt
      + Number(attack.firstAttackDelay ?? step.interval);
    if (scheduleTask) {
      scheduleTask(clone, clone.nextAttackAt);
    }
    return clone;
  };

  /** Returns next attack time across all clones (or Infinity if none). */
  const nextAttackAt = () => {
    let next = Infinity;
    for (const clone of profession.clones) {
      next = Math.min(next, clone.nextAttackAt);
    }
    return next;
  };

  /** Schedules a clone attack: adds damage, conditions, advances nextAttackAt by interval. */
  const scheduleAttack = (clone, at) => {
    const attack = attackFor(clone);
    const step = sequenceStep(clone, attack);
    const skillName = step.name || `${clone.weapon} Clone`;
    const cloneSkill = {
      name: skillName,
      weapon: clone.weapon,
      blade: false,
    };
    addDamage(cloneSkill, at, {
      coefficient: step.coefficient,
      hits: step.hits,
      source: "Clone",
      weaponStrength: attack.weaponStrength,
    }, {
      cloneId: clone.id,
      source: "Clone",
    });
    for (const condition of step.conditions || []) {
      addCondition(
        skillName,
        at,
        condition,
        "Clone",
        "",
        { cloneId: clone.id },
      );
    }
    if (Array.isArray(attack.sequence) && attack.sequence.length > 0) {
      clone.attackSequenceIndex =
        (Number(clone.attackSequenceIndex || 0) + 1) % attack.sequence.length;
    }
  };

  /**
   * Processes all clones due at time; schedules their attacks, advances nextAttackAt.
   * @param {number} at - Current time
   */
  const scheduleAt = (at) => {
    for (const clone of profession.clones) {
      if (clone.nextAttackAt > at + epsilon) continue;
      scheduleAttack(clone, at);
      const attack = attackFor(clone);
      clone.nextAttackAt += Number(sequenceStep(clone, attack).interval);
    }
  };

  const handleTask = (cloneId, at) => {
    const clone = profession.clones.find(
      candidate => candidate.id === Number(cloneId),
    );
    if (!clone) return;
    scheduleAttack(clone, at);
    const attack = attackFor(clone);
    clone.nextAttackAt = at + Number(sequenceStep(clone, attack).interval);
    if (scheduleTask) scheduleTask(clone, clone.nextAttackAt);
  };

  return {
    handleTask,
    initializeClone,
    nextAttackAt,
    scheduleAt,
  };
}
