import { createCloneAttackScheduler } from "../mechanics/sim-illusion-actions.js";
import { createProfessionActionController } from "../mechanics/sim-profession-actions.js";
import { createSchedulerEventFactory } from "./sim-scheduler-events.js";
import { createSchedulerIntentController } from "./sim-scheduler-intents.js";
import { createSchedulerState } from "./sim-scheduler-state.js";

const CLARITY_DURATION = 15;
const CLARITY_ICON =
  "https://wiki.guildwars2.com/wiki/Special:FilePath/Clarity.png";
const CLARITY_CONSUMERS = new Set([
  "Imaginary Inversion",
  "Phantasmal Lancer",
  "Mental Collapse",
]);

/**
 * Main simulation scheduler: orchestrates combat state, action timing, clone attacks, effects.
 * Two-phase pipeline: 1) Player actions via cast(), 2) Clone/phantasm attacks are sequenced.
 *
 * Creates scheduler instance coordinating state, intents, events, and profession mechanics.
 * @param {Object} config - Simulation config (specialization, stats, boons, target)
 * @param {Set} traits - Selected trait names for this build
 * @param {number} horizon - Simulation end time (seconds)
 * @param {Object} model - Scheduler model with skill lookups, data tables, helper functions
 * @returns {Object} Scheduler with: state, events[], warnings[], cast(skill), advanceTo(time), cloneDeaths
 *
 * @example
 * const scheduler = createScheduler(config, traits, 30, SCHEDULER_MODEL);
 * scheduler.cast(skillById(123)); // queue action at current time
 * scheduler.advanceTo(5); // process all pending events until 5s
 * console.log(scheduler.events); // all scheduled events up to 5s
 */
export function createScheduler(config, traits, horizon, model) {
  const {
    AMBUSH_ATTACKS,
    ARISTOCRACY_SKILLS,
    AUTOATTACK_CHAINS,
    BLIND_SKILLS,
    CLONE_ATTACKS,
    CONDITION_FORMULAS,
    CONTINUUM_UNAFFECTED_COOLDOWN_IDS,
    CONTROL_SKILLS,
    EPSILON,
    INSTRUMENTS,
    PEITHA_SKILLS,
    PHANTASM_ATTACK_TIMINGS,
    PHANTASM_NAME_BY_SKILL,
    SHATTERS,
    adjustedCooldown,
    allSkills,
    autoattackChainPositions,
    baseCriticalChance,
    byName,
    clamp,
    conditionName,
    flipSkillsByParent,
    getResourceDefinition,
    skillAvailable,
    skillsById,
    skillsByName,
  } = model;
  const events = [];
  const warnings = [];
  const resourceDefinition = getResourceDefinition(config.specialization);
  const cloneDeaths = new Map();
  let cloneSequence = 0;

  const state = createSchedulerState({
    infiniteForge: traits.has("Infinite Forge"),
  });
  let intentController = null;

  const activePrimaryWeapon = () =>
    state.activeWeaponSet === 1
      ? config.primaryWeapon
      : config.weaponSet2Primary || config.primaryWeapon;

  const queueCombatIntent = (intent) => {
    if (intent.at > horizon + EPSILON) return;
    intentController.queue(intent);
  };

  const {
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
  } = createSchedulerEventFactory({
    events,
    horizon,
    epsilon: EPSILON,
    conditionName,
    conditionFormulas: CONDITION_FORMULAS,
    queueCombatIntent,
    activePrimaryWeapon,
    activeWeaponSet: () => state.activeWeaponSet,
  });

  const cloneAttackScheduler = createCloneAttackScheduler({
    state,
    cloneAttacks: CLONE_ATTACKS,
    epsilon: EPSILON,
    addDamage,
    addCondition,
  });

  /** Schedules Compounding Power buff stacks at a time. */
  const markCompounding = (at, count) => {
    for (let index = 0; index < count; index += 1) {
      addEvent({
        type: "buff",
        at: at + index * EPSILON,
        kind: "compounding",
        stacks: 1,
        duration: 8,
      });
    }
  };

  /**
   * Gains resources (clones or numeric). Handles clone creation, respawning, Compounding Power.
   * Clones: queued with weapon, pushed to state.clones, old clones removed at max.
   * Numeric: clamped to [0, maximum], triggers trait procs (Compounding Power, resource traits).
   * @param {number} at - Time resources are gained
   * @param {number} count - Number of resources to gain
   * @param {string} weapon - Weapon for new clones (ignored for numeric resources)
   * @param {string} reason - Reason string for trait/event tracking
   */
  const gainResources = (at, count, weapon, reason = "") => {
    const amount = Math.max(0, Number(count || 0));
    if (!amount) return;
    let gained = 0;
    const created = [];

    if (resourceDefinition.singular === "clone") {
      for (let index = 0; index < amount; index += 1) {
        if (state.clones.length >= resourceDefinition.maximum) {
          const replaced = state.clones.shift();
          cloneDeaths.set(replaced.id, at);
        }
        const clone = {
          id: ++cloneSequence,
          createdAt: at + index * EPSILON,
          weapon: weapon || activePrimaryWeapon(),
        };
        state.clones.push(cloneAttackScheduler.initializeClone(clone));
        created.push({ id: clone.id, weapon: clone.weapon });
        gained += 1;
      }
    } else {
      const before = state.numericResource;
      state.numericResource = clamp(
        before + amount,
        0,
        resourceDefinition.maximum,
      );
      gained = state.numericResource - before;
    }

    if (gained > 0) {
      addEvent({
        type: "resource",
        at,
        amount: gained,
        value:
          resourceDefinition.singular === "clone"
            ? state.clones.length
            : state.numericResource,
        resource: resourceDefinition.plural,
        reason,
        created,
      });
      if (traits.has("Compounding Power") && reason !== "initial") {
        markCompounding(at, gained);
        addTraitProc(
          "Compounding Power",
          at,
          reason,
          `${gained} stack${gained === 1 ? "" : "s"}`,
        );
      }
      const resourceTrait = [
        "Bloodsong",
        "Deceptive Evasion",
        "Fortissimo",
        "Illusionary Reversion",
        "Infinite Forge",
      ].find((name) => reason.startsWith(name));
      if (resourceTrait && traits.has(resourceTrait)) {
        addTraitProc(
          resourceTrait,
          at,
          reason,
          `+${gained} ${resourceDefinition.singular}`,
        );
      }
    }
  };

  /** Queues resource gain to be processed at specified time (sorted by time). */
  const queueResources = (at, count, weapon, reason) => {
    state.pendingResources.push({ at, count, weapon, reason });
    state.pendingResources.sort((a, b) => a.at - b.at);
  };

  intentController = createSchedulerIntentController({
    state,
    config,
    traits,
    cloneDeaths,
    epsilon: EPSILON,
    baseCriticalChance,
    activePrimaryWeapon,
    queueResources,
  });

  /** Calculates max ammo charges for a skill (e.g., Split Second with Shatter Storm = 2, Power Spike = 2). */
  const ammoMaximum = (skill) => {
    if (skill.name === "Split Second" && traits.has("Shatter Storm")) return 2;
    return Number(skill.ammo || 0);
  };

  /** Creates or retrieves ammo state for a skill, initializing with max charges. */
  const ensureAmmo = (skill) => {
    const maximum = ammoMaximum(skill);
    if (!maximum) return null;
    if (!state.ammo.has(skill.id)) {
      state.ammo.set(skill.id, {
        charges: maximum,
        maximum,
        rechargeDuration: adjustedCooldown(skill, config),
        nextRechargeAt: null,
      });
    }
    return state.ammo.get(skill.id);
  };

  /**
   * Recharges ammo for a skill up to a given time, handling recharge ticks and cooldown sync.
   * @param {Object} skill - Skill with ammo
   * @param {number} at - Current time (processes all recharges up to this time)
   * @returns {Object|null} Updated ammo state or null if skill has no ammo
   */
  const refreshAmmo = (skill, at) => {
    const ammo = ensureAmmo(skill);
    if (!ammo) return null;
    while (
      ammo.nextRechargeAt != null &&
      ammo.nextRechargeAt <= at + EPSILON
    ) {
      ammo.charges = Math.min(ammo.maximum, ammo.charges + 1);
      ammo.nextRechargeAt =
        ammo.charges < ammo.maximum
          ? ammo.nextRechargeAt + ammo.rechargeDuration
          : null;
    }
    if (ammo.charges === 0 && ammo.nextRechargeAt != null) {
      state.cooldowns.set(skill.id, ammo.nextRechargeAt);
    } else {
      state.cooldowns.delete(skill.id);
    }
    return ammo;
  };

  /**
   * Restores Continuum Split state: cooldowns, ammo charges, autoattack chains.
   * Called when split window expires or manual shift executed.
   * @param {number} at - Shift time
   * @param {string} reason - Shift reason (e.g., "split expired", "manual shift")
   */
  const restoreContinuum = (at, reason) => {
    if (!state.continuum) return;
    const splitReady = state.continuum.splitReady;
    const unaffectedCooldowns = [...state.cooldowns]
      .filter(([id]) => CONTINUUM_UNAFFECTED_COOLDOWN_IDS.has(id));
    state.cooldowns = new Map([
      ...unaffectedCooldowns,
      ...[...state.continuum.remainingCooldowns]
        .filter(([, remaining]) => remaining > EPSILON)
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
    state.autoattackChains = new Map(
      state.continuum.autoattackChains || [],
    );
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

  /**
   * Advances scheduler to target time, processing all pending events in order:
   * clone attacks → intents (player-queuedactions) → continuum expiry → Infinite Forge → resource gains.
   * Cleanup: expires instruments, flips, refreshes ammo.
   * @param {number} target - Target time to advance to
   */
  const advanceTo = (target) => {
    let guard = 0;
    while (guard++ < 100_000) {
      const pendingAt = state.pendingResources[0]?.at ?? Infinity;
      const intentAt = intentController.nextAt();
      const continuumAt = state.continuum?.expiresAt ?? Infinity;
      const cloneAttackAt = cloneAttackScheduler.nextAttackAt();
      const next = Math.min(
        pendingAt,
        intentAt,
        continuumAt,
        cloneAttackAt,
        state.nextForgeAt,
      );
      if (next > target + EPSILON) break;

      if (next === cloneAttackAt) {
        cloneAttackScheduler.scheduleAt(cloneAttackAt);
        continue;
      }
      if (next === intentAt) {
        intentController.processNext();
        continue;
      }
      if (next === continuumAt) {
        restoreContinuum(continuumAt, "split expired");
        continue;
      }
      if (next === state.nextForgeAt) {
        gainResources(next, 1, activePrimaryWeapon(), "Infinite Forge");
        state.nextForgeAt += 3;
        continue;
      }
      const pending = state.pendingResources.shift();
      gainResources(
        pending.at,
        pending.count,
        pending.weapon,
        pending.reason,
      );
    }

    for (const [instrument, expiresAt] of state.instruments) {
      if (expiresAt <= target + EPSILON) state.instruments.delete(instrument);
    }
    for (const [name, flip] of state.availableFlips) {
      if (flip.expiresAt < target - EPSILON) {
        state.availableFlips.delete(name);
        if (name === "Counterspell") state.counterspellAvailable = false;
      }
    }
    for (const [id] of state.ammo) {
      const ammoSkill = skillsById.get(id);
      if (ammoSkill) refreshAmmo(ammoSkill, target);
    }
  };

  const {
    consumeResources,
    currentResource,
    handleCrescendo,
    handleInstrument,
    handleShatter,
    triggerShatterTraits,
  } = createProfessionActionController({
    state,
    traits,
    resourceDefinition,
    cloneDeaths,
    epsilon: EPSILON,
    shatters: SHATTERS,
    instruments: INSTRUMENTS,
    warnings,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    activePrimaryWeapon,
    queueResources,
    byName,
  });

  /** Updates autoattack chain state after a skill cast. Progresses chain or clears on weapon swap/instant cast. */
  const updateAutoattackChains = (skill, baseActivation) => {
    const position = autoattackChainPositions.get(skill.name);
    if (position) {
      for (const root of state.autoattackChains.keys()) {
        if (root !== position.root) state.autoattackChains.delete(root);
      }
      const chain = AUTOATTACK_CHAINS[position.root];
      const next = chain[(position.index + 1) % chain.length];
      if (next === position.root) {
        state.autoattackChains.delete(position.root);
      } else {
        state.autoattackChains.set(position.root, next);
      }
      return;
    }
    if (skill.id === -3) {
      state.autoattackChains.clear();
      return;
    }
    if (baseActivation > 0) {
      for (const root of state.autoattackChains.keys()) {
        const preserveScepterChain =
          root === "Ether Bolt" &&
          skill.type === "Weapon";
        if (!preserveScepterChain) state.autoattackChains.delete(root);
      }
    }
  };

  /**
   * Handles Continuum Split: captures cooldown/ammo state, calculates window duration (1.5s per resource spent).
   * @param {Object} skill - Continuum Split skill
   * @param {number} at - Time of cast
   */
  const handleContinuumSplit = (skill, at) => {
    const spent = consumeResources(at);
    const remainingCooldowns = new Map(
      [...state.cooldowns]
        .filter(([id]) =>
          id !== skill.id && !CONTINUUM_UNAFFECTED_COOLDOWN_IDS.has(id))
        // Keep signed time here. Concurrent Continuum Split is initially
        // scheduled after the anchor cast and then moved into that cast; a
        // cooldown that expired between those two timestamps still had time
        // remaining at the actual Split snapshot.
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

  /**
   * Handles Mirage Ambush: damage, conditions, and Infinite Horizon clone hits.
   * Only runs if specialization === "Mirage".
   * @param {number} at - Time of ambush (dodge end time)
   */
  const handleAmbush = (at) => {
    if (config.specialization !== "Mirage") return;
    const weapon = activePrimaryWeapon();
    const ambush = AMBUSH_ATTACKS[weapon];
    if (!ambush) {
      warnings.push(`No modeled Mirage ambush for ${weapon}.`);
      return;
    }
    const pseudo = {
      name: ambush.name,
      weapon,
      blade: false,
    };
    addDamage(pseudo, at, {
      coefficient: ambush.coefficient,
      hits: ambush.hits,
      source: "Player",
    });
    for (const condition of ambush.conditions || []) {
      addCondition(ambush.name, at, condition);
    }
    if (traits.has("Infinite Horizon")) {
      const attack = CLONE_ATTACKS[weapon] || CLONE_ATTACKS.Sword;
      if (state.clones.length) {
        addTraitProc(
          "Infinite Horizon",
          at + EPSILON,
          ambush.name,
          `${state.clones.length} clone${state.clones.length === 1 ? "" : "s"}`,
        );
      }
      for (const clone of state.clones) {
        addDamage(
          pseudo,
          at + EPSILON,
          {
            coefficient: ambush.coefficient,
            hits: ambush.hits,
            source: "Clone",
          },
          {
            cloneId: clone.id,
            weaponStrength: attack.weaponStrength,
            source: "Clone",
            name: `${ambush.name} — Clone`,
          },
        );
        for (const condition of ambush.conditions || []) {
          addCondition(
            `${ambush.name} — Clone`,
            at,
            condition,
            "Clone",
          );
        }
      }
    }
  };

  /**
   * Handles generic skill: applies damage, conditions, resources, trait procs (Fencer's Finesse, etc.).
   * Handles pulse counts, phantasm conversions, flip arms, and Signet of the Ether resets.
   * @param {Object} skill - Skill to process
   * @param {number} at - Impact time (damage/condition application)
   * @param {number} castStart - Cast start time (used for pulse calculations)
   */
  const handleGenericSkill = (skill, at, castStart = at) => {
    const useCount = state.skillUses.get(skill.id) || 1;
    const clarityConsumed =
      CLARITY_CONSUMERS.has(skill.name) &&
      state.clarityUntil > castStart;
    if (CLARITY_CONSUMERS.has(skill.name)) {
      state.clarityUntil = 0;
    }
    const pulseCount = Math.max(
      1,
      Math.trunc(Number(skill.pulseCount || 1)),
    );
    const pulseTimes =
      pulseCount > 1
        ? Array.from(
            { length: pulseCount },
            (_, index) =>
              castStart + ((at - castStart) * (index + 1)) / pulseCount,
          )
        : [];
    const etherCloneAtMaximum =
      skill.name === "Ether Clone" &&
      resourceDefinition.singular === "clone" &&
      currentResource() >= resourceDefinition.maximum;
    const isPhantasm = skill.resource?.mode === "phantasm";
    // Bountiful Blades: Phantasmal Berserker summons an additional berserker
    // (2 total), but each berserker deals 33% less damage. Net phantasm damage
    // is 2 * 0.67 = 1.34x a single berserker.
    const bountifulBerserker =
      skill.name === "Phantasmal Berserker" && traits.has("Bountiful Blades");
    const bountifulBerserkerDamage = bountifulBerserker ? 0.67 : 1;
    const phantasmCount = isPhantasm
      ? Number(skill.resource?.count || 1) *
        (skill.name === "Phantasmal Lancer" && clarityConsumed ? 2 : 1) *
        (bountifulBerserker ? 2 : 1)
      : 1;
    const phantasmName = PHANTASM_NAME_BY_SKILL[skill.name] || skill.name;
    const phantasmTiming = PHANTASM_ATTACK_TIMINGS[phantasmName];
    const hasChronophantasma =
      isPhantasm && traits.has("Chronophantasma");
    const phantasmSpeed = traits.has("Phantasmal Haste") ? 1.5 : 1;
    const phantasmEndpoint = (offset) => {
      const measuredCastTime = Number(phantasmTiming?.castTime || 0);
      const measuredPostCast = Number(offset) - measuredCastTime;
      const actualCastTime = at - castStart;
      return castStart + actualCastTime + measuredPostCast / phantasmSpeed;
    };
    const phantasmDamageAt = phantasmEndpoint(phantasmTiming?.damage);
    const phantasmSpawnAt = phantasmEndpoint(phantasmTiming?.spawn);
    const chronophantasmaDamageAt = phantasmEndpoint(
      phantasmTiming?.chronophantasmaDamage,
    );
    const phantasmConversionAt = hasChronophantasma
      ? phantasmEndpoint(phantasmTiming?.chronophantasmaSpawn)
      : phantasmSpawnAt;
    const virtuosoBladeHits =
      resourceDefinition.singular === "blade"
      && !hasChronophantasma
      && Array.isArray(phantasmTiming?.virtuosoBladeHits)
        ? phantasmTiming.virtuosoBladeHits
        : null;
    let chronophantasmaProc = false;

    if (isPhantasm) {
      const count = phantasmCount;
      if (traits.has("Compounding Power")) {
        markCompounding(at, count);
        addTraitProc(
          "Compounding Power",
          at,
          skill.name,
          `${count} phantasm${count === 1 ? "" : "s"}`,
        );
      }
      addEvent({
        type: "phantasm_summoned",
        at,
        name: skill.name,
        count,
      });
      addEvent({
        type: "phantasm_attack",
        at: phantasmDamageAt,
        name: skill.name,
        count,
        repeat: false,
        complete: true,
      });
      if (hasChronophantasma) {
        if (traits.has("Compounding Power")) {
          markCompounding(phantasmSpawnAt, count);
          addTraitProc(
            "Compounding Power",
            phantasmSpawnAt,
            `${skill.name} — Chronophantasma`,
            `${count} phantasm${count === 1 ? "" : "s"}`,
          );
        }
        addEvent({
          type: "phantasm_resummoned",
          at: phantasmSpawnAt,
          name: skill.name,
          count,
        });
        addEvent({
          type: "phantasm_attack",
          at: chronophantasmaDamageAt,
          name: skill.name,
          count,
          repeat: true,
          complete: true,
        });
      }
    }

    for (const group of skill.damage || []) {
      const hitAt =
        group.source === "Phantasm" ? phantasmDamageAt : at;
      const selectedGroup =
        skill.boonlessCoefficient && config.target?.boonless
          ? { ...group, coefficient: skill.boonlessCoefficient }
          : group;
      const scaledGroup =
        group.source === "Phantasm" && phantasmCount > 1
          ? {
              ...selectedGroup,
              coefficient:
                Number(selectedGroup.coefficient || 0)
                * phantasmCount
                * bountifulBerserkerDamage,
              hits: Number(selectedGroup.hits || 1) * phantasmCount,
            }
          : selectedGroup;
      if (
        pulseTimes.length > 0
        && group.source !== "Phantasm"
        && Number(scaledGroup.hits || 1) === pulseCount
      ) {
        for (const pulseAt of pulseTimes) {
          addDamage(skill, pulseAt, {
            ...scaledGroup,
            coefficient: Number(scaledGroup.coefficient || 0) / pulseCount,
            hits: 1,
          });
        }
      } else {
        addDamage(skill, hitAt, scaledGroup);
      }
      if (
        group.source === "Phantasm" &&
        hasChronophantasma
      ) {
        addDamage(skill, chronophantasmaDamageAt, scaledGroup, {
          name: `${skill.name} — Chronophantasma`,
          multiplier: 1.05,
        });
        if (!chronophantasmaProc) {
          addTraitProc(
            "Chronophantasma",
            phantasmSpawnAt,
            skill.name,
          );
          chronophantasmaProc = true;
        }
      }
    }
    if (skill.everyThirdDamage && useCount % 3 === 0) {
      addDamage(skill, at, skill.everyThirdDamage, {
        blade: skill.blade,
      });
    }

    const appliedConditions = etherCloneAtMaximum
      ? skill.maxCloneConditions || []
      : skill.conditions || [];
    const conditionAt = isPhantasm ? phantasmDamageAt : at;
    for (const condition of appliedConditions) {
      const scaledCondition =
        isPhantasm && phantasmCount > 1
          ? {
              ...condition,
              stacks: Number(condition.stacks || 1) * phantasmCount,
            }
          : condition;
      if (
        pulseTimes.length > 0
        && !isPhantasm
        && Number(scaledCondition.stacks || 1) === pulseCount
      ) {
        for (const pulseAt of pulseTimes) {
          addCondition(skill.name, pulseAt, {
            ...scaledCondition,
            stacks: 1,
          });
        }
      } else {
        addCondition(
          skill.name,
          conditionAt,
          scaledCondition,
          isPhantasm ? "Phantasm" : "Player",
        );
      }
    }
    if (isPhantasm && hasChronophantasma && appliedConditions.length > 0) {
      for (const condition of appliedConditions) {
        const scaledCondition =
          phantasmCount > 1
            ? {
                ...condition,
                stacks: Number(condition.stacks || 1) * phantasmCount,
              }
            : condition;
        addCondition(
          skill.name,
          chronophantasmaDamageAt,
          scaledCondition,
          "Phantasm",
          `${skill.name} — Chronophantasma`,
        );
      }
    }
    if (skill.resource?.mode === "fill") {
      queueResources(
        at + EPSILON,
        resourceDefinition.maximum,
        skill.weapon || activePrimaryWeapon(),
        skill.name,
      );
    } else if (skill.resource?.mode === "add" && !etherCloneAtMaximum) {
      queueResources(
        at + EPSILON,
        skill.resource.count,
        skill.weapon || activePrimaryWeapon(),
        skill.name,
      );
    } else if (skill.resource?.mode === "phantasm" && virtuosoBladeHits) {
      for (let index = 0; index < phantasmCount; index += 1) {
        const measuredOffset =
          virtuosoBladeHits[Math.min(index, virtuosoBladeHits.length - 1)];
        queueResources(
          phantasmEndpoint(measuredOffset) + EPSILON,
          1,
          null,
          `${skill.name} phantasm conversion`,
        );
      }
    } else if (skill.resource?.mode === "phantasm") {
      queueResources(
        phantasmConversionAt + EPSILON,
        phantasmCount,
        null,
        `${skill.name} phantasm conversion`,
      );
    }

    if (skill.name === "Mind the Gap") {
      state.clarityUntil = at + CLARITY_DURATION;
      addEvent({
        type: "proc",
        procType: "skill",
        at,
        name: "Clarity",
        sourceSkill: skill.name,
        detail: "Spear skills 3-5 empowered for 15s",
        icon: CLARITY_ICON,
      });
    }

    if (skill.name === "Signet of the Ether") {
      for (const phantasmSkill of allSkills.filter(
        (candidate) => candidate.phantasm,
      )) {
        state.cooldowns.delete(phantasmSkill.id);
      }
      addEvent({
        type: "marker",
        at,
        name: "Signet of the Ether",
        detail: "Phantasm skill cooldowns reset",
      });
    }

    if (skill.name === "Mental Collapse") {
      const mindTheGap = skillsByName.get("Mind the Gap");
      if (mindTheGap) {
        state.cooldowns.delete(mindTheGap.id);
        addEvent({
          type: "marker",
          at,
          name: "Mental Collapse",
          detail: "Mind the Gap cooldown reset",
        });
      }
    }

    if (
      traits.has("Fencer's Finesse") &&
      skill.weapon === "Sword" &&
      (skill.damage || []).some((group) => group.source === "Player")
    ) {
      addEvent({
        type: "buff",
        at: at + EPSILON,
        kind: "fencer",
        stacks: Math.min(
          10,
          skill.damage.reduce(
            (sum, group) =>
              sum + (group.source === "Player" ? Number(group.hits || 1) : 0),
            0,
          ),
        ),
        duration: 6,
      });
      addTraitProc("Fencer's Finesse", at + EPSILON, skill.name);
    }
    return clarityConsumed;
  };

  /** Initializes scheduler: sets starting weapon set, initial resources, Split Second ammo. */
  const initialize = () => {
    if (config.startingWeaponSet === 2 && config.weaponSet2Primary) {
      state.activeWeaponSet = 2;
      addEvent({ type: "weapon_set", at: 0, weaponSet: 2 });
    }
    const initial = clamp(
      Number(config.initialResource || 0),
      0,
      resourceDefinition.maximum,
    );
    gainResources(0, initial, config.primaryWeapon, "initial");
    const splitSecond = skillsByName.get("Split Second");
    if (splitSecond) ensureAmmo(splitSecond);
    // Mantras are pre-channeled on the bench: arm their ammo-based flips (e.g.
    // Power Spike) from the opening with a full set of charges.
    for (const skill of allSkills) {
      if (skill.armedAtStart && skill.flipParent && ammoMaximum(skill)) {
        state.availableFlips.set(skill.name, {
          availableAt: 0,
          expiresAt: Infinity,
        });
        ensureAmmo(skill);
      }
    }
  };

  /**
   * Queues a skill cast at current time. Handles availability, cooldowns, resources, flips.
   * Advances time to activation end, applies damage/conditions, handles profession mechanics.
   * Returns false if cast failed (unavailable, cooldown, no resource, etc.); true if queued.
   * @param {Object} skill - Skill to cast (must have name, cooldown, activation, etc.)
   * @returns {boolean} True if cast queued successfully
   */
  const cast = (skill) => {
    advanceTo(state.time);
    if (!skillAvailable(skill, config)) {
      warnings.push(`${skill.name} is unavailable for this build.`);
      return false;
    }

    const chainPosition = autoattackChainPositions.get(skill.name);
    if (chainPosition) {
      const expected =
        state.autoattackChains.get(chainPosition.root) || chainPosition.root;
      if (skill.name !== expected) {
        warnings.push(
          `${skill.name} skipped at ${state.time.toFixed(2)}s: cast ${expected} first.`,
        );
        return false;
      }
    }

    if (skill.flipParent) {
      const activeFlip = state.availableFlips.get(skill.name);
      if (!activeFlip || activeFlip.expiresAt < state.time - EPSILON) {
        warnings.push(
          `${skill.name} skipped at ${state.time.toFixed(2)}s: ${skill.flipParent} is not active.`,
        );
        return false;
      }
      if (activeFlip.availableAt > state.time + EPSILON) {
        if (!config.autoWaitForCooldowns) {
          warnings.push(
            `${skill.name} skipped at ${state.time.toFixed(2)}s: available at ${activeFlip.availableAt.toFixed(2)}s.`,
          );
          return false;
        }
        state.time = activeFlip.availableAt;
        advanceTo(state.time);
      }
    }

    if (
      SHATTERS[skill.name]?.kind.startsWith("blade") &&
      currentResource() < 1
    ) {
      warnings.push(`${skill.name} skipped at ${state.time.toFixed(2)}s: no blades.`);
      return false;
    }

    let ammo = refreshAmmo(skill, state.time);
    let readyAt = ammo && ammo.charges === 0
      ? ammo.nextRechargeAt
      : state.cooldowns.get(skill.id) || 0;
    if (readyAt > state.time + EPSILON) {
      if (!config.autoWaitForCooldowns) {
        warnings.push(
          `${skill.name} skipped at ${state.time.toFixed(2)}s: ready at ${readyAt.toFixed(2)}s.`,
        );
        return false;
      }
      if (state.continuum?.expiresAt < readyAt) {
        state.time = state.continuum.expiresAt;
        advanceTo(state.time);
        readyAt = state.cooldowns.get(skill.id) || state.time;
      }
      state.time = Math.max(state.time, readyAt);
      advanceTo(state.time);
      ammo = refreshAmmo(skill, state.time);
    }
    if (state.time >= horizon - EPSILON) return false;

    const start = state.time;
    const quickness = config.boons?.quickness ? 1.5 : 1;
    const baseActivation = Number(
      skill.activation ?? (skill.id < 0 ? 0 : 0.5),
    );
    const activation = baseActivation / quickness;
    const end = Math.min(horizon, start + Math.max(0.05, activation));
    // Shatters consume their clones/blades when the cast begins. Keep the
    // amount for damage resolution at cast completion so resources generated
    // during a bladesong are not incorrectly fired by that same bladesong.
    const shatterSpent =
      SHATTERS[skill.name]
      && SHATTERS[skill.name].kind !== "continuum"
        ? consumeResources(start)
        : null;
    state.time = end;
    advanceTo(end);
    state.skillUses.set(skill.id, (state.skillUses.get(skill.id) || 0) + 1);

    const cooldown = adjustedCooldown(skill, config);
    if (ammo) {
      ammo.charges -= 1;
      if (ammo.nextRechargeAt == null) {
        ammo.nextRechargeAt = start + ammo.rechargeDuration;
      }
      refreshAmmo(skill, start);
    } else if (cooldown) {
      const cooldownStart = skill.cooldownStartsOnCastEnd ? end : start;
      state.cooldowns.set(skill.id, cooldownStart + cooldown);
    }
    addEvent({
      type: "action",
      at: start,
      endsAt: end,
      name: skill.name,
      skillId: skill.id,
      rechargeReadyAt: state.cooldowns.get(skill.id) ?? null,
    });
    updateAutoattackChains(skill, baseActivation);

    if (skill.id === -3) {
      state.activeWeaponSet = state.activeWeaponSet === 1 ? 2 : 1;
      addEvent({
        type: "weapon_set",
        at: end,
        weaponSet: state.activeWeaponSet,
      });
      return true;
    }
    if (skill.id === -4) {
      if (state.continuum) {
        restoreContinuum(end, "manual shift");
      } else {
        warnings.push(`Continuum Shift skipped at ${end.toFixed(2)}s: no active split.`);
      }
      return true;
    }
    if (skill.id === -1) {
      handleAmbush(end);
      if (traits.has("Deceptive Evasion")) {
        queueResources(
          end + EPSILON,
          1,
          activePrimaryWeapon(),
          "Deceptive Evasion",
        );
      }
      return true;
    }

    let clarityConsumed = false;
    if (skill.name === "Continuum Split") {
      handleContinuumSplit(skill, end);
    } else if (SHATTERS[skill.name]) {
      handleShatter(skill, end, shatterSpent);
    } else if (INSTRUMENTS[skill.name]) {
      handleInstrument(skill, end);
    } else if (skill.name === "Crescendo") {
      handleCrescendo(skill, end);
    } else {
      clarityConsumed = handleGenericSkill(skill, end, start);
      const armedFlip = flipSkillsByParent.get(skill.name);
      if (armedFlip && ammoMaximum(armedFlip)) {
        // Ammo mantra (e.g. Mantra of Pain → Power Spike): re-channeling refills
        // every charge and keeps the flip available until it is emptied again.
        state.availableFlips.set(armedFlip.name, {
          availableAt: end,
          expiresAt: Infinity,
        });
        state.ammo.delete(armedFlip.id);
        state.cooldowns.delete(armedFlip.id);
        ensureAmmo(armedFlip);
      } else if (armedFlip) {
        const flip = {
          availableAt: start + Number(armedFlip.flipDelay || 0),
          expiresAt: start + Number(armedFlip.flipDuration || 0),
        };
        if (flip.expiresAt >= end - EPSILON) {
          state.availableFlips.set(armedFlip.name, flip);
          if (armedFlip.name === "Counterspell") {
            state.counterspellAvailable = true;
          }
        }
      }
      if (skill.flipParent) {
        const flipAmmo = state.ammo.get(skill.id);
        if (flipAmmo && flipAmmo.maximum) {
          // Keep an ammo flip available while charges remain; once the last one
          // is spent it reverts to its parent mantra (must be re-channeled).
          if (flipAmmo.charges <= 0) {
            state.availableFlips.delete(skill.name);
            state.ammo.delete(skill.id);
            state.cooldowns.delete(skill.id);
          }
        } else {
          state.availableFlips.delete(skill.name);
        }
        if (skill.name === "Counterspell") {
          state.counterspellAvailable = false;
        }
        if (skill.parentCooldownIncrease) {
          const parent = skillsByName.get(skill.flipParent);
          const parentReadyAt = parent
            ? state.cooldowns.get(parent.id)
            : null;
          if (parent && parentReadyAt != null) {
            state.cooldowns.set(
              parent.id,
              parentReadyAt +
                adjustedCooldown(parent, config) *
                  Number(skill.parentCooldownIncrease),
            );
          }
        }
      }
    }
    if (
      CONTROL_SKILLS.has(skill.name) ||
      (skill.name === "Mental Collapse" && clarityConsumed)
    ) {
      addEvent({
        type: "control",
        at: end,
        skillName: skill.name,
      });
    }
    if (BLIND_SKILLS.has(skill.name)) {
      addEvent({
        type: "blind",
        at: end,
        skillName: skill.name,
      });
    }
    if (
      ARISTOCRACY_SKILLS.has(skill.name)
      || (CONTROL_SKILLS.has(skill.name) && traits.has("Dazzling"))
    ) {
      addEvent({
        type: "weakness_vulnerability",
        at: end,
        skillName: skill.name,
      });
    }
    if (PEITHA_SKILLS.has(skill.name)) {
      addEvent({
        type: "peitha",
        at: end,
        skillName: skill.name,
      });
    }
    return true;
  };

  initialize();
  return {
    state,
    events,
    warnings,
    cloneDeaths,
    advanceTo,
    cast,
  };
}
