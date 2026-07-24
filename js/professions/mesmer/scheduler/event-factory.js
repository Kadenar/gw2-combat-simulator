/**
 * Creates scheduled damage, condition, trait, and base events.
 * Queues expected-proc candidates (Bloodsong, Jagged Mind, Sharper Images).
 * @param {Array} events - Event array to populate
 * @param {number} horizon - Simulation end time (events past this are dropped)
 * @param {number} epsilon - Floating-point epsilon
 * @param {Function} conditionName - Condition name normalizer
 * @param {Object} conditionFormulas - Valid conditions lookup
 * @param {Function} queueExpectedProc - Expected-proc candidate queue
 * @param {Function} activePrimaryWeapon - Current primary weapon getter
 * @param {Function} activeWeaponSet - Current weapon set getter
 * @returns {Object} Factory with addEvent, addTraitProc, addCondition, addDamage
 */
export function createEventFactory({
  events,
  horizon,
  epsilon,
  conditionName,
  conditionFormulas,
  queueExpectedProc,
  activePrimaryWeapon,
  activeWeaponSet,
}) {
  /**
   * Adds event to array if within horizon.
   * @param {Object} event - Event object with at (time) property
   * @returns {Object} The event (for chaining)
   */
  const addEvent = (event) => {
    if (event.at <= horizon + epsilon) events.push(event);
    return event;
  };

  /**
   * Adds trait proc event (trait name, trigger, optional detail).
   * @param {string} name - Trait name
   * @param {number} at - Proc time
   * @param {string} sourceSkill - Triggering skill name (optional)
   * @param {string} detail - Extra detail (e.g., "2 stacks", "2 clones") (optional)
   * @returns {Object} Proc event
   */
  const addTraitProc = (
    name,
    at,
    sourceSkill = "",
    detail = "",
  ) => addEvent({
    type: "proc",
    procType: "trait",
    at,
    name,
    sourceSkill,
    detail,
  });

  /**
   * Adds a condition event and queues a bleeding proc candidate.
   * Only adds if condition has formula and duration.
   * @param {string} skillName - Skill applying condition
   * @param {number} at - Application time
   * @param {Object} condition - {name, duration, stacks}
   * @param {string} source - Action source (Player/Clone/Phantasm)
   * @param {string} label - Override display name (optional)
   * @param {Object} extra - Extra properties (cloneId, etc.) (optional)
   * @returns {Object|null} Condition event or null if invalid
   */
  const addCondition = (
    skillName,
    at,
    condition,
    source = "Player",
    label = "",
    extra = {},
  ) => {
    const name = conditionName(condition.name);
    if (!conditionFormulas[name] || !condition.duration) return null;
    const event = addEvent({
      type: "condition",
      at,
      skillName,
      name: label || `${skillName} — ${name}`,
      condition: name,
      duration: Number(condition.duration),
      stacks: Number(condition.stacks || 1),
      source,
      ...extra,
    });
    if (name === "Bleeding") {
      queueExpectedProc({
        type: "bleeding",
        at,
        stacks: Number(condition.stacks || 1),
        source,
        cloneId: extra.cloneId,
        sourceSkill: skillName,
      });
    }
    return event;
  };

  /**
   * Adds damage events and queues hit proc candidates.
   * Splits damage coefficient evenly across all hits.
   * @param {Object} skill - Skill with name, weapon, blade props
   * @param {number} at - Damage time
   * @param {Object} group - {coefficient, hits, source, weapon, weaponStrength}
   * @param {Object} extra - Extra props (name, cloneId, blade, source override, etc.) (optional)
   */
  const addDamage = (skill, at, group, extra = {}) => {
    const hits = Math.max(1, Math.trunc(Number(group.hits || 1)));
    const coefficient = Number(group.coefficient || 0) / hits;
    for (let index = 0; index < hits; index += 1) {
      addEvent({
        type: "damage",
        at,
        name: extra.name || skill.name,
        skillName: skill.name,
        coefficient,
        hits: 1,
        hitIndex: index + 1,
        totalHits: hits,
        source: group.source || extra.source || "Player",
        weapon: group.weapon || "",
        weaponStrength: group.weaponStrength,
        skillWeapon: skill.weapon || activePrimaryWeapon(),
        blade: Boolean(extra.blade ?? skill.blade),
        ...extra,
      });
      queueExpectedProc({
        type: "hit",
        at,
        hits: 1,
        source: group.source || extra.source || "Player",
        blade: Boolean(extra.blade ?? skill.blade),
        cloneId: extra.cloneId,
        sourceSkill: skill.name,
        weaponSet: activeWeaponSet(),
      });
    }
  };

  return {
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
  };
}
