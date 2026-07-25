import {
  indexAutoattackChains,
} from "../../../platform/engine/autoattack-chains.js";
import { EPSILON } from "../../../platform/engine/clock.js";
import {
  gw2EffectiveCooldown,
  gw2RechargeRate,
  gw2SigilSet,
  gw2StaticAttributes,
} from "../../../platform/gw2/runtime-rules.js";
import {
  createGw2SchedulerEventFactory,
} from "../../../platform/gw2/scheduler/event-factory.js";
import {
  AMBUSH_ATTACKS,
  CLONE_ATTACKS,
  PHANTASM_ATTACK_TIMINGS,
  PHANTASM_NAME_BY_SKILL,
  WEAPON_STRENGTH,
} from "../data/mesmer-illusion-data.js";
import {
  ARISTOCRACY_SKILLS,
  BLIND_SKILLS,
  CONDITION_FORMULAS,
  CONTROL_SKILLS,
  INSTRUMENTS,
  MECHANIC_SKILLS,
  PEITHA_SKILLS,
  SHATTERS,
  TRAIT_DAMAGE,
} from "../data/mesmer-profession-data.js";
import {
  createCloneAttackScheduler,
} from "./illusions.js";
import {
  createMirageActionController,
} from "./mirage.js";
import {
  createProfessionActionController,
} from "./profession-actions.js";
import {
  MESMER_AUTOATTACK_CHAINS,
  MESMER_PRESERVED_WEAPON_CHAIN_ROOT_IDS,
} from "./autoattack-chains.js";
import {
  createContinuumController,
} from "./continuum.js";
import {
  createExpectedProcTracker,
} from "./expected-procs.js";
import {
  createResourceController,
} from "./resources.js";
import {
  createSkillEffectController,
} from "./skill-effects.js";
import {
  mesmerResourceDefinition,
} from "../state.js";

const TASK = Object.freeze({
  cloneAttack: "mesmer.clone-attack",
  resourceGain: "mesmer.resource-gain",
  expectedProc: "mesmer.expected-proc",
  continuumExpire: "mesmer.continuum-expire",
  infiniteForge: "mesmer.infinite-forge",
});
const CONTINUUM_UNAFFECTED_COOLDOWN_IDS = new Set([-3]);
const autoattackChainPositions = indexAutoattackChains(
  MESMER_AUTOATTACK_CHAINS,
);
const preservedWeaponChainRoots = new Set(
  MESMER_PRESERVED_WEAPON_CHAIN_ROOT_IDS,
);
const runtimes = new WeakMap();

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

function conditionName(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "poison" || normalized === "poisoned") return "Poisoned";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function traitNames(config, catalog) {
  const names = new Set(config.selectedTraits || []);
  const selectedIds = new Set([
    ...(config.selectedTraitIds || []),
    ...(config.traitIds || []),
  ].map(Number));
  for (const trait of catalog.traits || []) {
    if (selectedIds.has(Number(trait.id))) names.add(trait.name);
  }
  return names;
}

function skillAvailable(skill, config) {
  if (skill.ambush) return config.specialization === "Mirage";
  if (skill.id < 0) {
    return (
      !skill.specialization
      || skill.specialization === config.specialization
    );
  }
  if (skill.environment !== "Terrestrial") return false;
  if (skill.type === "Profession") {
    return (MECHANIC_SKILLS[config.specialization] || []).includes(skill.name);
  }
  if (
    skill.specialization
    && skill.type !== "Weapon"
    && skill.specialization !== config.specialization
  ) return false;
  if (
    skill.specialization
    && skill.type === "Weapon"
    && !config.weaponmasterTraining
    && skill.specialization !== config.specialization
  ) return false;
  return true;
}

function baseCriticalChance(
  config,
  traits,
  source = "Player",
  weaponSet = 1,
) {
  const stats = gw2StaticAttributes(config);
  const illusion = source === "Clone" || source === "Phantasm";
  let chance = 0.05 + Math.max(0, stats.precision - 1000) / 2100;
  if (!illusion) {
    chance += Number(config.stats?.criticalChanceBonus || 0) / 100;
    chance +=
      Number(gw2SigilSet(config, weaponSet).criticalChanceBonus || 0) / 100;
  }
  if (!illusion && config.boons?.fury) chance += 0.25;
  if (
    !illusion
    && config.relic === "Mistburn"
    && Number(config.boons?.might || 0) >= 10
  ) chance += 0.1;
  if (
    traits.has("Flow of Time")
    && config.boons?.alacrity
    && ["Player", "Clone", "Phantasm"].includes(source)
  ) chance += 0.15;
  if (!illusion && traits.has("Quiet Intensity") && config.boons?.fury) {
    chance += 0.15;
  }
  if (source === "Phantasm" && traits.has("Phantasmal Fury")) {
    chance += config.specialization === "Virtuoso" ? 0.4 : 0.25;
  }
  return clamp(chance, 0, 1);
}

function runtimeFor(context) {
  const runtime = runtimes.get(context.state);
  if (!runtime) throw new Error("Mesmer scheduler runtime is not initialized.");
  return runtime;
}

function createMesmerRuntime(context) {
  const {
    state,
    config,
    catalog,
    cooldownController,
  } = context;
  const traits = traitNames(config, catalog);
  const resourceDefinition = mesmerResourceDefinition(config.specialization);
  const skillsById = catalog.skillsById;
  const skillsByName = catalog.skillsByName;
  const allSkills = catalog.skills;
  const flipSkillsByParent = new Map(
    allSkills
      .filter(skill => skill.flipParent)
      .map(skill => [skill.flipParent, skill]),
  );
  const runtime = {
    context,
    traits,
    resourceDefinition,
    skillsById,
    skillsByName,
    flipSkillsByParent,
    activeEmission: null,
    castDetails: new Map(),
  };
  const activePrimaryWeapon = () =>
    state.activeWeaponSet === 1
      ? config.primaryWeapon
      : config.weaponSet2Primary || config.primaryWeapon;

  const emit = event => {
    const active = runtime.activeEmission;
    if (
      active
      && Number(event.at) > active.effectiveEnd + EPSILON
    ) {
      if (event.type !== "condition" || !active.skill.applyConditionsOnInterrupt) {
        return null;
      }
      return context.emit({ ...event, at: active.effectiveEnd });
    }
    return context.emit(event);
  };
  const {
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
  } = createGw2SchedulerEventFactory({
    events: context.events,
    emit,
    defaultSource: "Mesmer",
    horizon: Infinity,
    epsilon: EPSILON,
    conditionName,
    conditionFormulas: CONDITION_FORMULAS,
    activePrimaryWeapon,
    activeWeaponSet: () => state.activeWeaponSet,
    decorateDamageEvent(event, { skill, extra }) {
      const explicit = String(event.weapon || "");
      const normalized =
        explicit.charAt(0).toUpperCase() + explicit.slice(1).toLowerCase();
      return {
        ...event,
        blade: Boolean(extra.blade ?? skill.blade),
        weaponStrength:
          event.weaponStrength
          ?? WEAPON_STRENGTH[normalized]
          ?? WEAPON_STRENGTH[event.skillWeapon],
      };
    },
  });

  const scheduleCloneTask = (clone, at) => context.tasks.schedule({
    type: TASK.cloneAttack,
    at,
    // Legacy temporal semantics resolve a clone's due attack before gains,
    // replacement, shatter, and other profession work at the same timestamp.
    priority: -50,
    ownerId: clone.ownerId,
    payload: { cloneId: clone.id },
  });
  const cloneAttackScheduler = createCloneAttackScheduler({
    state,
    cloneAttacks: CLONE_ATTACKS,
    epsilon: EPSILON,
    addDamage,
    addCondition,
    scheduleTask: scheduleCloneTask,
  });
  const destroyClone = (clone, at) => {
    context.tasks.cancelOwner(clone.ownerId || `mesmer.clone:${clone.id}`);
  };
  const scheduleResourceTask = candidate => {
    if (
      runtime.activeEmission
      && candidate.at > runtime.activeEmission.effectiveEnd + EPSILON
    ) return;
    context.tasks.schedule({
      type: TASK.resourceGain,
      at: Math.max(state.time, candidate.at),
      payload: candidate,
    });
  };
  const resources = createResourceController({
    state,
    traits,
    resourceDefinition,
    epsilon: EPSILON,
    clamp,
    activePrimaryWeapon,
    cloneAttackScheduler,
    addEvent,
    addTraitProc,
    destroyClone,
    scheduleResourceTask,
  });
  const expected = createExpectedProcTracker({
    state,
    config,
    traits,
    epsilon: EPSILON,
    baseCriticalChance,
    activePrimaryWeapon,
    queueResources: resources.queueResources,
  });
  const actions = createProfessionActionController({
    state,
    traits,
    resourceDefinition,
    destroyClone,
    epsilon: EPSILON,
    shatters: SHATTERS,
    instruments: INSTRUMENTS,
    warnings: context.warnings,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    activePrimaryWeapon,
    queueResources: resources.queueResources,
    byName: name => skillsByName.get(name),
    traitDamage: TRAIT_DAMAGE,
  });
  const continuum = createContinuumController({
    state,
    unaffectedCooldownIds: CONTINUUM_UNAFFECTED_COOLDOWN_IDS,
    epsilon: EPSILON,
    skillsById,
    refreshAmmo: cooldownController.refreshAmmo,
    consumeResources: actions.consumeResources,
    triggerShatterTraits: actions.triggerShatterTraits,
    addEvent,
    scheduleExpiry: at => context.tasks.schedule({
      type: TASK.continuumExpire,
      at,
      priority: -30,
      ownerId: "mesmer.continuum",
      payload: { expiresAt: at },
    }),
  });
  const mirage = createMirageActionController({
    state,
    config,
    traits,
    ambushAttacks: AMBUSH_ATTACKS,
    cloneAttacks: CLONE_ATTACKS,
    skillsByName,
    epsilon: EPSILON,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    activePrimaryWeapon,
    queueResources: resources.queueResources,
    currentResource: actions.currentResource,
  });
  resources.setAmbushCreatedClones(mirage.executeCloneAmbushes);
  const skillEffects = createSkillEffectController({
    state,
    config,
    traits,
    resourceDefinition,
    phantasmNameBySkill: PHANTASM_NAME_BY_SKILL,
    phantasmAttackTimings: PHANTASM_ATTACK_TIMINGS,
    allSkills,
    skillsByName,
    epsilon: EPSILON,
    activePrimaryWeapon,
    currentResource: actions.currentResource,
    markCompounding: resources.markCompounding,
    queueResources: resources.queueResources,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    traitDamage: TRAIT_DAMAGE,
  });
  Object.assign(runtime, {
    activePrimaryWeapon,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    cloneAttackScheduler,
    destroyClone,
    resources,
    expected,
    actions,
    continuum,
    mirage,
    skillEffects,
  });
  return runtime;
}

function updateAutoattackChains(runtime, skill) {
  const { state } = runtime.context;
  const position = autoattackChainPositions.get(skill.id);
  if (position) {
    for (const root of state.profession.autoattackChains.keys()) {
      if (root !== position.root) state.profession.autoattackChains.delete(root);
    }
    if (position.next == null) {
      state.profession.autoattackChains.delete(position.root);
    } else {
      state.profession.autoattackChains.set(position.root, position.next);
    }
    return;
  }
  if (skill.id === -3) {
    state.profession.autoattackChains.clear();
    return;
  }
  if (Number(skill.activation || 0) > 0) {
    for (const root of state.profession.autoattackChains.keys()) {
      const preserve =
        preservedWeaponChainRoots.has(root) && skill.type === "Weapon";
      if (!preserve) state.profession.autoattackChains.delete(root);
    }
  }
}

function completeMesmerSkill(context, skill) {
  const runtime = runtimeFor(context);
  const details = runtime.castDetails.get(context.reservationId) || {};
  const {
    state,
  } = context;
  const at = context.fullEnd;
  runtime.activeEmission =
    context.effectiveEnd < context.fullEnd - EPSILON
      ? {
          skill,
          effectiveEnd: context.effectiveEnd,
        }
      : null;
  try {
    updateAutoattackChains(runtime, skill);
    if (skill.id === -3) {
      state.activeWeaponSet = state.activeWeaponSet === 1 ? 2 : 1;
      runtime.addEvent({
        type: "weapon_set",
        at: context.effectiveEnd,
        weaponSet: state.activeWeaponSet,
      });
      return;
    }
    if (skill.id === -4) {
      runtime.continuum.restoreContinuum(
        context.effectiveEnd,
        "manual shift",
      );
      return;
    }
    if (skill.id === -1) {
      runtime.mirage.grantMirageCloak(context.effectiveEnd, skill.name);
      if (runtime.traits.has("Deceptive Evasion")) {
        runtime.resources.queueResources(
          context.effectiveEnd + EPSILON,
          1,
          runtime.activePrimaryWeapon(),
          "Deceptive Evasion",
        );
      }
      return;
    }

    let clarityConsumed = false;
    if (skill.ambush) {
      runtime.mirage.executePlayerAmbush(skill, at);
    } else if (skill.name === "Continuum Split") {
      runtime.continuum.beginContinuumSplit(skill, at);
    } else if (SHATTERS[skill.name]) {
      runtime.actions.handleShatter(skill, at, details.shatterSpent);
      runtime.mirage.handleMirageShatter(
        skill,
        at,
        details.shatterSpent,
      );
    } else if (INSTRUMENTS[skill.name]) {
      runtime.actions.handleInstrument(skill, at);
    } else if (skill.name === "Crescendo") {
      runtime.actions.handleCrescendo(skill, at);
    } else {
      clarityConsumed = runtime.skillEffects.handleGenericSkill(
        skill,
        at,
        context.start,
      );
      runtime.mirage.handlePostSkill(skill, at);
      const armedFlip = runtime.flipSkillsByParent.get(skill.name);
      if (armedFlip && context.maximumAmmoFor(armedFlip)) {
        state.profession.availableFlips.set(armedFlip.name, {
          availableAt: at,
          expiresAt: Infinity,
        });
        state.ammo.delete(armedFlip.id);
        state.cooldowns.delete(armedFlip.id);
        context.cooldownController.ensureAmmo(armedFlip, at);
      } else if (armedFlip) {
        const flip = {
          availableAt: context.start + Number(armedFlip.flipDelay || 0),
          expiresAt: context.start + Number(armedFlip.flipDuration || 0),
        };
        if (flip.expiresAt >= at - EPSILON) {
          state.profession.availableFlips.set(armedFlip.name, flip);
          if (armedFlip.name === "Counterspell") {
            state.profession.counterspellAvailable = true;
          }
        }
      }
      if (skill.flipParent) {
        const flipAmmo = state.ammo.get(skill.id);
        if (flipAmmo?.maximum) {
          if (flipAmmo.charges <= 0) {
            state.profession.availableFlips.delete(skill.name);
            state.ammo.delete(skill.id);
            state.cooldowns.delete(skill.id);
          }
        } else {
          state.profession.availableFlips.delete(skill.name);
        }
        if (skill.name === "Counterspell") {
          state.profession.counterspellAvailable = false;
        }
        if (skill.parentCooldownIncrease) {
          const parent = runtime.skillsByName.get(skill.flipParent);
          const parentReadyAt = parent
            ? state.cooldowns.get(parent.id)
            : null;
          if (parent && parentReadyAt != null) {
            state.cooldowns.set(
              parent.id,
              parentReadyAt
                + context.rechargeDurationFor(parent, at)
                  * Number(skill.parentCooldownIncrease),
            );
          }
        }
      }
    }
    const disabled =
      CONTROL_SKILLS.has(skill.name)
      || (skill.name === "Mental Collapse" && clarityConsumed);
    if (disabled) {
      runtime.addEvent({ type: "control", at, skillName: skill.name });
      if (
        runtime.traits.has("Danger Time")
        && (
          skill.name === "Time Sink"
          || runtime.traits.has("Delayed Reactions")
        )
      ) {
        runtime.addEvent({
          type: "buff",
          at,
          kind: "danger-time",
          stacks: 1,
          duration: 10,
          sourceSkill: skill.name,
        });
        runtime.addTraitProc("Danger Time", at, skill.name);
      }
      if (runtime.traits.has("Syncopate")) {
        const damage = TRAIT_DAMAGE.Syncopate;
        runtime.addDamage(
          { name: "Syncopate", weapon: "Utility", blade: false },
          at,
          {
            coefficient: damage.coefficient,
            hits: damage.hits,
            source: "Player",
            weapon: "utility",
          },
        );
        runtime.addTraitProc("Syncopate", at, skill.name);
      }
    }
    if (BLIND_SKILLS.has(skill.name)) {
      runtime.addEvent({ type: "blind", at, skillName: skill.name });
    }
    if (
      ARISTOCRACY_SKILLS.has(skill.name)
      || (CONTROL_SKILLS.has(skill.name) && runtime.traits.has("Dazzling"))
    ) {
      runtime.addEvent({
        type: "weakness_vulnerability",
        at,
        skillName: skill.name,
      });
    }
    if (PEITHA_SKILLS.has(skill.name)) {
      runtime.addEvent({ type: "peitha", at, skillName: skill.name });
    }
  } finally {
    runtime.activeEmission = null;
    runtime.castDetails.delete(context.reservationId);
  }
}

export function initializeMesmerScheduler(context) {
  if (
    context.state.activeWeaponSet === 2
    && !context.config.weaponSet2Primary
    && !context.config.weaponSet2Secondary
  ) {
    context.state.activeWeaponSet = 1;
  }
  const runtime = createMesmerRuntime(context);
  runtimes.set(context.state, runtime);
  const { state, config } = context;
  state.profession.riddleOfSandReady = runtime.traits.has("Riddle of Sand");
  const initial = clamp(
    Number(config.initialResource || 0),
    0,
    runtime.resourceDefinition.maximum,
  );
  runtime.resources.gainResources(
    0,
    initial,
    config.primaryWeapon,
    "initial",
  );
  for (const name of ["Split Second", "Dodge / Mirage Cloak"]) {
    const skill = runtime.skillsByName.get(name);
    if (skill) context.cooldownController.ensureAmmo(skill, 0);
  }
  for (const skill of context.catalog.skills) {
    if (
      skill.armedAtStart
      && skill.flipParent
      && context.maximumAmmoFor(skill)
    ) {
      state.profession.availableFlips.set(skill.name, {
        availableAt: 0,
        expiresAt: Infinity,
      });
      context.cooldownController.ensureAmmo(skill, 0);
    }
  }
  if (runtime.traits.has("Infinite Forge")) {
    context.tasks.schedule({
      type: TASK.infiniteForge,
      at: 3,
      priority: -20,
      ownerId: "mesmer.infinite-forge",
      payload: {},
    });
  }
}

export function mesmerAvailability(context, skill) {
  const runtime = runtimeFor(context);
  const { state } = context;
  const at = context.start;
  if (!skillAvailable(skill, context.config)) {
    return {
      ready: false,
      retryAt: null,
      code: "mesmer.build",
      reason: `${skill.name} is unavailable for this build.`,
    };
  }
  if (skill.ambush) {
    const activeAmbush = AMBUSH_ATTACKS[runtime.activePrimaryWeapon()];
    if (
      !activeAmbush
      || activeAmbush.name !== skill.name
      || !state.profession.ambushSource
      || state.profession.ambushUntil <= at + EPSILON
    ) {
      return {
        ready: false,
        retryAt: null,
        code: "mesmer.ambush",
        reason: `${skill.name} has no active Mirage Cloak ambush window.`,
      };
    }
  }
  const position = autoattackChainPositions.get(skill.id);
  if (position) {
    const expected =
      state.profession.autoattackChains.get(position.root) || position.root;
    if (skill.id !== expected) {
      return {
        ready: false,
        retryAt: null,
        code: "mesmer.autoattack-chain",
        reason: `Cannot cast ${skill.name}; cast ${
          runtime.skillsById.get(expected)?.name || expected
        } first.`,
      };
    }
  }
  if (skill.flipParent) {
    const flip = state.profession.availableFlips.get(skill.name);
    if (!flip || flip.expiresAt < at - EPSILON) {
      const parent = runtime.skillsByName.get(skill.flipParent);
      if (parent && context.inFlight.get(parent.id)?.size) {
        return {
          ready: false,
          retryAt: null,
          code: "mesmer.flip-parent-in-flight",
          reason: `${skill.flipParent} is still channeling.`,
        };
      }
      return {
        ready: false,
        retryAt: null,
        code: "mesmer.flip-not-armed",
        reason: `${skill.flipParent} is not active.`,
      };
    }
    if (flip.availableAt > at + EPSILON) {
      return {
        ready: false,
        retryAt: flip.availableAt,
        code: "mesmer.flip-not-ready",
        reason:
          `${skill.name} is not armed until ${flip.availableAt.toFixed(3)}.`,
      };
    }
  }
  if (
    SHATTERS[skill.name]?.kind.startsWith("blade")
    && runtime.actions.currentResource() < 1
  ) {
    return {
      ready: false,
      retryAt: null,
      code: "mesmer.no-blades",
      reason: `${skill.name} requires at least one blade.`,
    };
  }
  return { ready: true };
}

export function startMesmerCast(context, skill) {
  const runtime = runtimeFor(context);
  const shatterSpent =
    SHATTERS[skill.name] && SHATTERS[skill.name].kind !== "continuum"
      ? runtime.actions.consumeResources(context.start)
      : null;
  runtime.castDetails.set(context.reservationId, { shatterSpent });
}

export function scheduleMesmerSkill() {
  return true;
}

export function completeMesmerCast(context, skill) {
  completeMesmerSkill(context, skill);
}

export function advanceMesmerScheduler(context, target) {
  const profession = context.state.profession;
  for (const [instrument, expiresAt] of profession.instruments) {
    if (expiresAt <= target + EPSILON) {
      profession.instruments.delete(instrument);
    }
  }
  for (const [name, flip] of profession.availableFlips) {
    if (flip.expiresAt < target - EPSILON) {
      profession.availableFlips.delete(name);
      if (name === "Counterspell") {
        profession.counterspellAvailable = false;
      }
    }
  }
}

export function observeMesmerEvent(context, event) {
  const runtime = runtimes.get(context.state);
  if (!runtime) return;
  let candidate = null;
  if (event.type === "condition" && event.condition === "Bleeding") {
    candidate = {
      type: "bleeding",
      at: event.at,
      stacks: event.stacks,
      source: event.source,
      cloneId: event.cloneId,
      sourceSkill: event.skillName,
    };
  } else if (event.type === "damage") {
    candidate = {
      type: "hit",
      at: event.at,
      hits: 1,
      source: event.source,
      blade: event.blade,
      cloneId: event.cloneId,
      sourceSkill: event.skillName,
      weaponSet: context.state.activeWeaponSet,
    };
  }
  if (!candidate) return;
  context.tasks.schedule({
    type: TASK.expectedProc,
    at: Math.max(context.state.time, event.at),
    priority: -40,
    ownerId:
      event.cloneId == null ? null : `mesmer.clone:${event.cloneId}`,
    payload: candidate,
  });
}

export function handleCloneAttackTask(context, task) {
  runtimeFor(context).cloneAttackScheduler.handleTask(
    task.payload.cloneId,
    task.at,
  );
}

export function handleResourceGainTask(context, task) {
  const runtime = runtimeFor(context);
  const { count, weapon, reason } = task.payload;
  runtime.resources.gainResources(task.at, count, weapon, reason);
}

export function handleExpectedProcTask(context, task) {
  runtimeFor(context).expected.process(task.payload);
}

export function handleContinuumExpiryTask(context, task) {
  const active = context.state.profession.continuum;
  if (
    !active
    || Math.abs(active.expiresAt - task.payload.expiresAt) > EPSILON
  ) return;
  runtimeFor(context).continuum.restoreContinuum(task.at, "split expired");
}

export function handleInfiniteForgeTask(context, task) {
  const runtime = runtimeFor(context);
  runtime.resources.gainResources(
    task.at,
    1,
    runtime.activePrimaryWeapon(),
    "Infinite Forge",
  );
  context.tasks.schedule({
    type: TASK.infiniteForge,
    at: task.at + 3,
    priority: -20,
    ownerId: "mesmer.infinite-forge",
    payload: {},
  });
}

export function modifyMesmerRecharge(context, sharedDuration) {
  const { skill, config } = context;
  if (context.ammoCastLockout) return sharedDuration;
  if (skill.name === "Swap Weapons") return Number(skill.cooldown || 0);
  if (skill.name === "Dodge / Mirage Cloak") {
    return Number(skill.cooldown || 0) / (config.boons?.vigor ? 1.5 : 1);
  }
  const traits = runtimeFor(context).traits;
  let multiplier = 1;
  if (
    SHATTERS[skill.name]
    && traits.has("Master of Misdirection")
  ) multiplier *= 0.85;
  if (skill.weapon === "Sword" && traits.has("Fencer's Finesse")) {
    multiplier *= 0.8;
  }
  return gw2EffectiveCooldown(skill, config, {
    cooldownMultiplier: multiplier,
    rechargeRate: gw2RechargeRate(config, {
      alacrityRate: config.specialization === "Chronomancer" ? 1.5 : 1.25,
    }),
  });
}

export function modifyMesmerCastDuration(context) {
  const base = Math.max(
    0,
    Number(context.skill.activation ?? context.skill.castTime ?? 0),
  );
  const duration = context.config.boons?.quickness ? base / 1.5 : base;
  return duration > 0 ? duration : 0.05;
}

export function modifyMesmerRechargeStart(context, effectiveEnd) {
  return Number(context.skill.activation ?? context.skill.castTime ?? 0) > 0
    ? effectiveEnd
    : context.start;
}

export function modifyMesmerMaximumAmmo(context, maximum) {
  return (
    context.skill.name === "Split Second"
    && runtimeFor(context).traits.has("Shatter Storm")
  )
    ? 2
    : maximum;
}

export function projectMesmerEndState(context) {
  const runtime = runtimeFor(context);
  const { state, config } = context;
  const endTime = state.time;
  const definition = runtime.resourceDefinition;
  const availableFlips = {};
  for (const [name, flip] of state.profession.availableFlips) {
    if (flip.expiresAt < endTime - EPSILON) continue;
    const persistent = !Number.isFinite(flip.expiresAt);
    availableFlips[name] = {
      availableAt: Math.round(flip.availableAt * 1000),
      expiresAt: persistent ? null : Math.round(flip.expiresAt * 1000),
      remaining: persistent
        ? null
        : Math.max(0, Math.round((flip.expiresAt - endTime) * 1000)),
      persistent,
    };
  }
  const activeWeapon =
    state.activeWeaponSet === 1
      ? config.primaryWeapon
      : config.weaponSet2Primary || config.primaryWeapon;
  return {
    resource:
      definition.singular === "clone"
        ? state.profession.clones.length
        : state.profession.numericResource,
    resourceDefinition: definition,
    clarityRemaining: Math.max(
      0,
      Math.round((state.profession.clarityUntil - endTime) * 1000),
    ),
    counterspellAvailable: state.profession.counterspellAvailable,
    availableAmbush:
      state.profession.ambushSource
      && state.profession.ambushUntil > endTime + EPSILON
        ? {
            name: AMBUSH_ATTACKS[activeWeapon]?.name || "",
            source: state.profession.ambushSource,
            expiresAt: Math.round(state.profession.ambushUntil * 1000),
            remaining: Math.max(
              0,
              Math.round((state.profession.ambushUntil - endTime) * 1000),
            ),
          }
        : null,
    availableFlips,
    autoattackChains: Object.fromEntries(
      MESMER_AUTOATTACK_CHAINS.map(chain => [
        chain[0],
        state.profession.autoattackChains.get(chain[0]) || chain[0],
      ]),
    ),
    continuumActive: Boolean(state.profession.continuum),
    continuumRemaining: state.profession.continuum
      ? Math.max(
          0,
          Math.round(
            (state.profession.continuum.expiresAt - endTime) * 1000,
          ),
        )
      : 0,
  };
}

export const mesmerCastRules = Object.freeze({
  availability: {
    id: "mesmer.availability",
    order: 10,
    handler: mesmerAvailability,
  },
  modifyRechargeDuration: modifyMesmerRecharge,
  modifyCastDuration: modifyMesmerCastDuration,
  modifyRechargeStart: modifyMesmerRechargeStart,
  modifyMaximumAmmo: modifyMesmerMaximumAmmo,
  scheduleSkill: scheduleMesmerSkill,
});

export const mesmerSchedulerHooks = Object.freeze({
  initialize: initializeMesmerScheduler,
  advance: advanceMesmerScheduler,
  onCastStart: startMesmerCast,
  onCastComplete: completeMesmerCast,
  onEventScheduled: observeMesmerEvent,
  taskHandlers: Object.freeze({
    [TASK.cloneAttack]: handleCloneAttackTask,
    [TASK.resourceGain]: handleResourceGainTask,
    [TASK.expectedProc]: handleExpectedProcTask,
    [TASK.continuumExpire]: handleContinuumExpiryTask,
    [TASK.infiniteForge]: handleInfiniteForgeTask,
  }),
});
