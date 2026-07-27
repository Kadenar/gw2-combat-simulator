import { EPSILON } from "../../../platform/engine/clock.js";
import {
  gw2EffectiveCooldown,
  gw2RechargeRate,
} from "../../../platform/gw2/runtime-rules.js";
import { createGw2SchedulerEventFactory } from "../../../platform/gw2/scheduler/event-factory.js";
import {
  AMBUSH_ATTACKS,
  ARISTOCRACY_SKILLS,
  BLIND_SKILLS,
  CLONE_ATTACKS,
  CONDITION_FORMULAS,
  CONTROL_SKILLS,
  INSTRUMENTS,
  PEITHA_SKILLS,
  PHANTASM_ATTACK_TIMINGS,
  PHANTASM_NAME_BY_SKILL,
  SHATTERS,
  TRAIT_DAMAGE,
  WEAPON_STRENGTH,
} from "./skill-mechanics.js";
import { MESMER_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { createCloneAttackScheduler } from "./specific/illusions.js";
import { createMirageActionController } from "./specific/mirage.js";
import { createProfessionActionController } from "./specific/profession-actions.js";
import {
  MESMER_AUTOATTACK_CHAINS,
  mesmerAutoattackChainPosition,
  mesmerPreservesAutoattackChain,
} from "./autoattack-chains.js";
import { createContinuumController } from "./specific/continuum.js";
import { createExpectedProcTracker } from "./specific/expected-procs.js";
import { createResourceController } from "./specific/resources.js";
import { createSkillEffectController } from "./specific/skill-effects.js";
import { mesmerResourceDefinition } from "../state.js";
import { runtimes, runtimeFor } from "./runtime.js";
import { mesmerAvailability } from "./availability.js";

const TASK = Object.freeze({
  cloneAttack: "mesmer.clone-attack",
  resourceGain: "mesmer.resource-gain",
  expectedProc: "mesmer.expected-proc",
  bladeSpend: "mesmer.blade-spend",
  continuumExpire: "mesmer.continuum-expire",
  infiniteForge: "mesmer.infinite-forge",
  signetEtherRelock: "mesmer.signet-ether-relock",
  signetIllusionsPassive: "mesmer.signet-illusions-passive",
});
// Delay before Signet of the Ether's in-game bug re-applies its own cooldown
// after the cast finishes.
const SIGNET_ETHER_RELOCK_DELAY = 0.3;
const SIGNET_ILLUSIONS_INTERVAL = 10;
const SIGNET_ILLUSIONS_OWNER = "mesmer.signet-illusions-passive";
const CONTINUUM_UNAFFECTED_COOLDOWN_IDS = new Set([-3]);
const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

function conditionName(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "poison" || normalized === "poisoned") return "Poisoned";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

// Builds a mixed trait set carrying both numeric ids (used by MESMER_TRAIT_IDS
// lookups in scheduler code) and names (used by data-driven references such as
// RESOURCE_TRAITS and skill damage-group requiredTrait fields). Accepts config
// traits supplied as ids, names, or both.
function traitSet(config, catalog) {
  const values = new Set([
    ...(config.selectedTraits || []),
    ...(config.selectedTraitIds || []).map(Number),
    ...(config.traitIds || []).map(Number),
  ]);
  const byId = new Map();
  const byName = new Map();
  for (const trait of catalog.traits || []) {
    byId.set(Number(trait.id), trait);
    byName.set(trait.name, trait);
  }
  for (const value of [...values]) {
    const trait = byName.get(value) || byId.get(Number(value));
    if (trait) {
      values.add(Number(trait.id));
      values.add(trait.name);
    }
  }
  return values;
}

function selectedSkillValues(config) {
  const selected = config.selectedSkills || [];
  return Array.isArray(selected) ? selected : Object.values(selected);
}

function equippedSignetOfIllusions(context) {
  const skill = context.catalog.skillsByName.get("Signet of Illusions");
  if (!skill) return null;
  const equipped = selectedSkillValues(context.config).some(
    (candidate) =>
      candidate === skill.name ||
      Number(candidate) === skill.id ||
      candidate?.name === skill.name ||
      Number(candidate?.id) === skill.id,
  );
  return equipped ? skill : null;
}

function scheduleSignetIllusionsPassive(context, at) {
  if (!equippedSignetOfIllusions(context)) return;
  context.tasks.cancelOwner(SIGNET_ILLUSIONS_OWNER);
  context.tasks.schedule({
    type: TASK.signetIllusionsPassive,
    at: Math.max(context.state.time, Number(at)),
    priority: -20,
    ownerId: SIGNET_ILLUSIONS_OWNER,
    payload: {},
  });
}

function restartSignetIllusionsPassive(context, activeAt) {
  const skill = equippedSignetOfIllusions(context);
  if (!skill) return;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  scheduleSignetIllusionsPassive(
    context,
    Math.max(Number(activeAt), readyAt) + SIGNET_ILLUSIONS_INTERVAL,
  );
}

function createMesmerRuntime(context) {
  const { state, config, catalog, cooldownController } = context;
  const traits = traitSet(config, catalog);
  const resourceDefinition = mesmerResourceDefinition(config.specialization);
  const skillsById = catalog.skillsById;
  const skillsByName = catalog.skillsByName;
  const allSkills = catalog.skills;
  const flipSkillsByParent = new Map(
    allSkills
      .filter((skill) => skill.flipParent)
      .map((skill) => [skill.flipParent, skill]),
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

  const emit = (event) => {
    const active = runtime.activeEmission;
    if (active && Number(event.at) > active.effectiveEnd + EPSILON) {
      if (
        event.type !== "condition" ||
        !active.skill.applyConditionsOnInterrupt
      ) {
        return null;
      }
      return context.emit({ ...event, at: active.effectiveEnd });
    }
    return context.emit(event);
  };
  const { addEvent, addTraitProc, addCondition, addDamage } =
    createGw2SchedulerEventFactory({
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
            event.weaponStrength ??
            WEAPON_STRENGTH[normalized] ??
            WEAPON_STRENGTH[event.skillWeapon],
        };
      },
    });

  const scheduleCloneTask = (clone, at) =>
    context.tasks.schedule({
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
  const scheduleResourceTask = (candidate) => {
    if (
      runtime.activeEmission &&
      candidate.at > runtime.activeEmission.effectiveEnd + EPSILON
    )
      return;
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
    criticalChance: (event) =>
      context.schedulerPolicy.critical?.(context, event)?.chance || 0,
    activePrimaryWeapon,
    queueResources: resources.queueResources,
    emitCondition: (cause, event) => context.emitDerived(cause, event),
    addTraitProc,
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
    byName: (name) => skillsByName.get(name),
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
    scheduleExpiry: (at) =>
      context.tasks.schedule({
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
    shatters: SHATTERS,
    instruments: INSTRUMENTS,
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
  const chains = state.profession.autoattackChains;
  const position = mesmerAutoattackChainPosition(skill.id);
  if (position) {
    // Object.keys yields string keys; chain roots are numeric skill ids, so
    // coerce before comparing against or passing to numeric-id consumers.
    for (const root of Object.keys(chains).map(Number)) {
      if (root !== position.root) delete chains[root];
    }
    if (position.next == null) {
      delete chains[position.root];
    } else {
      chains[position.root] = position.next;
    }
    return;
  }
  if (skill.id === -3) {
    state.profession.autoattackChains = {};
    return;
  }
  if (
    Number(skill.castTimeMs || 0) > 0 &&
    skill.rechargeAnchor !== "castStart"
  ) {
    for (const root of Object.keys(chains).map(Number)) {
      const preserve = mesmerPreservesAutoattackChain(root, skill);
      if (!preserve) delete chains[root];
    }
  }
}

function completeMesmerSkill(context, skill) {
  const runtime = runtimeFor(context);
  const details = runtime.castDetails.get(context.reservationId) || {};
  const { state } = context;
  const at = context.fullEnd;
  const interrupted = context.effectiveEnd < context.fullEnd - EPSILON;
  const phantasmSummonProgress = Number(skill.phantasmSummonProgress);
  const phantasmSummonThreshold =
    context.start + (context.fullEnd - context.start) * phantasmSummonProgress;
  const completedInterruptedPhantasm =
    interrupted &&
    Number.isFinite(phantasmSummonProgress) &&
    context.effectiveEnd >= phantasmSummonThreshold - EPSILON;
  runtime.activeEmission =
    interrupted && !completedInterruptedPhantasm
      ? {
          skill,
          effectiveEnd: context.effectiveEnd,
        }
      : null;
  try {
    if (
      details.reservedShatterResources &&
      context.effectiveEnd < context.fullEnd - EPSILON
    ) {
      runtime.actions.restoreReservedResources(details.shatterSpent);
      return;
    }
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
      runtime.continuum.restoreContinuum(context.effectiveEnd, "manual shift");
      return;
    }
    if (skill.id === -1) {
      runtime.mirage.grantMirageCloak(context.effectiveEnd, skill.name);
      if (runtime.traits.has(TRAIT.DECEPTIVE_EVASION)) {
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
      runtime.mirage.handleMirageShatter(skill, at, details.shatterSpent);
    } else if (INSTRUMENTS[skill.name]) {
      runtime.actions.handleInstrument(skill, at);
    } else if (skill.name === "Crescendo") {
      runtime.actions.handleCrescendo(skill, at);
    } else {
      clarityConsumed = runtime.skillEffects.handleGenericSkill(
        skill,
        at,
        context.start,
        completedInterruptedPhantasm
          ? {
              phantasmSummonAt: context.effectiveEnd,
              playerEffectEnd: context.effectiveEnd,
            }
          : undefined,
      );
      runtime.mirage.handlePostSkill(skill, at);
      const armedFlip = runtime.flipSkillsByParent.get(skill.name);
      if (armedFlip && context.maximumAmmoFor(armedFlip)) {
        state.profession.availableFlips[armedFlip.name] = {
          availableAt: at,
          expiresAt: Infinity,
        };
        state.ammo.delete(armedFlip.id);
        state.cooldowns.delete(armedFlip.id);
        context.cooldownController.ensureAmmo(armedFlip, at);
      } else if (armedFlip) {
        const flip = {
          availableAt: context.start + Number(armedFlip.flipDelay || 0),
          expiresAt: context.start + Number(armedFlip.flipDuration || 0),
        };
        if (flip.expiresAt >= at - EPSILON) {
          state.profession.availableFlips[armedFlip.name] = flip;
          if (armedFlip.name === "Counterspell") {
            state.profession.counterspellAvailable = true;
          }
        }
      }
      if (skill.flipParent) {
        const flipAmmo = state.ammo.get(skill.id);
        if (flipAmmo?.maximum) {
          if (flipAmmo.charges <= 0) {
            delete state.profession.availableFlips[skill.name];
            state.ammo.delete(skill.id);
            state.cooldowns.delete(skill.id);
          }
        } else {
          delete state.profession.availableFlips[skill.name];
        }
        if (skill.name === "Counterspell") {
          state.profession.counterspellAvailable = false;
        }
        if (skill.parentCooldownIncrease) {
          const parent = runtime.skillsByName.get(skill.flipParent);
          const parentReadyAt = parent ? state.cooldowns.get(parent.id) : null;
          if (parent && parentReadyAt != null) {
            state.cooldowns.set(
              parent.id,
              parentReadyAt +
                context.rechargeDurationFor(parent, at) *
                  Number(skill.parentCooldownIncrease),
            );
          }
        }
      }
    }
    if (skill.name === "Signet of the Ether") {
      // In-game bug: the signet re-applies its own cooldown 300ms after the
      // cast completes.
      context.tasks.schedule({
        type: TASK.signetEtherRelock,
        at: context.fullEnd + SIGNET_ETHER_RELOCK_DELAY,
        payload: { skillId: skill.id },
      });
    }
    if (skill.name === "Signet of Illusions") {
      restartSignetIllusionsPassive(context, context.fullEnd);
    }
    const disabled =
      CONTROL_SKILLS.has(skill.name) ||
      (skill.name === "Mental Collapse" && clarityConsumed);
    if (disabled) {
      runtime.addEvent({ type: "control", at, skillName: skill.name });
      if (
        runtime.traits.has(TRAIT.DANGER_TIME) &&
        (skill.name === "Time Sink" ||
          runtime.traits.has(TRAIT.DELAYED_REACTIONS))
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
      if (runtime.traits.has(TRAIT.SYNCOPATE)) {
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
      ARISTOCRACY_SKILLS.has(skill.name) ||
      (CONTROL_SKILLS.has(skill.name) && runtime.traits.has(TRAIT.DAZZLING))
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
    context.state.activeWeaponSet === 2 &&
    !context.config.weaponSet2Primary &&
    !context.config.weaponSet2Secondary
  ) {
    context.state.activeWeaponSet = 1;
  }
  const runtime = createMesmerRuntime(context);
  runtimes.set(context.state, runtime);
  const { state, config } = context;
  if (
    runtime.traits.has(TRAIT.JAGGED_MIND) ||
    runtime.traits.has(TRAIT.SHARPER_IMAGES) ||
    runtime.traits.has(TRAIT.DEADLY_BLADES)
  ) {
    context.schedulerPolicy.requireCriticalFacts?.();
  }
  state.profession.riddleOfSandReady = runtime.traits.has(TRAIT.RIDDLE_OF_SAND);
  const initial = clamp(
    Number(config.initialResource || 0),
    0,
    runtime.resourceDefinition.maximum,
  );
  runtime.resources.gainResources(0, initial, config.primaryWeapon, "initial");
  for (const skill of context.catalog.skills) {
    if (context.maximumAmmoFor(skill) > 0) {
      context.cooldownController.ensureAmmo(skill, 0);
    }
  }
  for (const skill of context.catalog.skills) {
    if (
      skill.armedAtStart &&
      skill.flipParent &&
      context.maximumAmmoFor(skill)
    ) {
      state.profession.availableFlips[skill.name] = {
        availableAt: 0,
        expiresAt: Infinity,
      };
      context.cooldownController.ensureAmmo(skill, 0);
    }
  }
  if (runtime.traits.has(TRAIT.INFINITE_FORGE)) {
    context.tasks.schedule({
      type: TASK.infiniteForge,
      at: 3,
      priority: -20,
      ownerId: "mesmer.infinite-forge",
      payload: {},
    });
  }
  restartSignetIllusionsPassive(context, 0);
}

export function startMesmerCast(context, skill) {
  const runtime = runtimeFor(context);
  const shatter = SHATTERS[skill.name];
  let shatterSpent = null;
  const spendProgress = Number(shatter?.resourceSpendProgress);
  const delayedBladeSpend =
    shatter?.kind.startsWith("blade") &&
    Number.isFinite(spendProgress) &&
    context.fullEnd > context.start + EPSILON;
  if (delayedBladeSpend) {
    shatterSpent = runtime.actions.reserveResources();
  } else if (shatter && shatter.kind !== "continuum") {
    shatterSpent = runtime.actions.consumeResources(context.start, {
      sourceSkill: skill.name,
      rotationIndex: context.commandIndex,
    });
  }
  runtime.castDetails.set(context.reservationId, {
    reservedShatterResources: delayedBladeSpend,
    shatterSpendCommitted: !delayedBladeSpend,
    shatterSpent,
  });
  if (delayedBladeSpend) {
    context.tasks.schedule({
      type: TASK.bladeSpend,
      at:
        spendProgress === 1
          ? context.fullEnd
          : context.start + (context.fullEnd - context.start) * spendProgress,
      // Run before the core cast-completion task (-100) when the spend is
      // scheduled exactly at fullEnd, so completion receives the spent count.
      priority: -110,
      ownerId: context.reservationId,
      payload: {
        reservationId: context.reservationId,
        sourceSkill: skill.name,
        rotationIndex: context.commandIndex,
      },
    });
  }
}

export function scheduleMesmerSkill() {
  return true;
}

export function completeMesmerCast(context, skill) {
  completeMesmerSkill(context, skill);
}

export function advanceMesmerScheduler(context, target) {
  const profession = context.state.profession;
  for (const [instrument, expiresAt] of Object.entries(
    profession.instruments,
  )) {
    if (expiresAt <= target + EPSILON) {
      delete profession.instruments[instrument];
    }
  }
  for (const [name, flip] of Object.entries(profession.availableFlips)) {
    if (flip.expiresAt < target - EPSILON) {
      delete profession.availableFlips[name];
      if (name === "Counterspell") {
        profession.counterspellAvailable = false;
      }
    }
  }
}

export function observeMesmerEvent(context, event) {
  const runtime = runtimes.get(context.state);
  if (!runtime) return;
  if (event.type === "combat_start") {
    context.state.profession.hasExplicitCombatStart = true;
    context.state.profession.combatStartTime = event.at;
    restartSignetIllusionsPassive(context, event.at);
  }
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
    const tracksCriticalTrait =
      (event.blade &&
        (runtime.traits.has(TRAIT.JAGGED_MIND) ||
          runtime.traits.has(TRAIT.DEADLY_BLADES))) ||
      (runtime.traits.has(TRAIT.SHARPER_IMAGES) &&
        (event.source === "Clone" || event.source === "Phantasm"));
    if (!tracksCriticalTrait) return;
    candidate = {
      type: "hit",
      at: event.at,
      event,
      cloneId: event.cloneId,
    };
  }
  if (!candidate) return;
  context.tasks.schedule({
    type: TASK.expectedProc,
    at: Math.max(context.state.time, event.at),
    priority: -40,
    ownerId: event.cloneId == null ? null : `mesmer.clone:${event.cloneId}`,
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
  const runtime = runtimeFor(context);
  const event = task.payload.type === "hit" ? task.payload.event : null;
  if (
    event?.blade &&
    !event.noCrit &&
    event.canCrit !== false &&
    runtime.traits.has(TRAIT.DEADLY_BLADES)
  ) {
    const vulnerabilityStacks =
      context.schedulerPolicy.critical?.(context, event)?.chance || 0;
    if (vulnerabilityStacks > EPSILON) {
      context.emitDerived(event, {
        type: "buff",
        at: event.at,
        kind: "target-vulnerability",
        stacks: vulnerabilityStacks,
        duration: 5,
        source: "Trait",
        sourceId: TRAIT.DEADLY_BLADES,
        sourceSkill: event.skillName,
      });
      context.emitDerived(event, {
        type: "weakness_vulnerability",
        at: event.at,
        source: "Trait",
        sourceId: TRAIT.DEADLY_BLADES,
        skillName: event.skillName,
      });
    }
  }
  runtime.expected.process(task.payload);
}

export function handleBladeSpendTask(context, task) {
  const runtime = runtimeFor(context);
  const details = runtime.castDetails.get(task.payload.reservationId);
  if (!details || details.shatterSpendCommitted) return;
  details.shatterSpent = runtime.actions.commitReservedResources(
    task.at,
    details.shatterSpent,
    {
      sourceSkill: task.payload.sourceSkill,
      rotationIndex: task.payload.rotationIndex,
    },
  );
  details.shatterSpendCommitted = true;
}

export function handleContinuumExpiryTask(context, task) {
  const active = context.state.profession.continuum;
  if (!active || Math.abs(active.expiresAt - task.payload.expiresAt) > EPSILON)
    return;
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

export function handleSignetEtherRelockTask(context, task) {
  const skill = context.catalog.skillsById.get(task.payload.skillId);
  if (!skill) return;
  // Restart the full recharge from the re-lock moment, mirroring the in-game
  // bug. Guard against ever shortening a longer cooldown already in place.
  const readyAt = task.at + context.rechargeDurationFor(skill, task.at);
  context.state.cooldowns.set(
    skill.id,
    Math.max(Number(context.state.cooldowns.get(skill.id) || 0), readyAt),
  );
}

export function handleSignetIllusionsPassiveTask(context, task) {
  const runtime = runtimeFor(context);
  const skill = equippedSignetOfIllusions(context);
  if (!skill) return;
  if (context.hasExplicitCombatStart && context.combatStartTime == null) return;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  if (readyAt > task.at + EPSILON) {
    restartSignetIllusionsPassive(context, readyAt);
    return;
  }
  runtime.resources.gainResources(
    task.at,
    1,
    runtime.activePrimaryWeapon(),
    skill.name,
  );
  scheduleSignetIllusionsPassive(context, task.at + SIGNET_ILLUSIONS_INTERVAL);
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
  if (SHATTERS[skill.name] && traits.has(TRAIT.MASTER_OF_MISDIRECTION))
    multiplier *= 0.85;
  if (skill.weapon === "Sword" && traits.has(TRAIT.FENCERS_FINESSE)) {
    multiplier *= 0.8;
  }
  return gw2EffectiveCooldown(skill, config, {
    cooldownMultiplier: multiplier,
    rechargeRate: gw2RechargeRate(config, {
      alacrityRate: config.specialization === "Chronomancer" ? 1.5 : 1.25,
    }),
  });
}

export function modifyMesmerMaximumAmmo(context, maximum) {
  const name = context.skill.name;
  const isSlot1 = SHATTERS[name]?.slot === 1 || INSTRUMENTS[name]?.slot === 1;
  return isSlot1 && runtimeFor(context).traits.has(TRAIT.SHATTER_STORM)
    ? 2
    : maximum;
}

export function projectMesmerEndState(context) {
  const runtime = runtimeFor(context);
  const { state, config } = context;
  const endTime = state.time;
  const definition = runtime.resourceDefinition;
  const availableFlips = {};
  for (const [name, flip] of Object.entries(state.profession.availableFlips)) {
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
      state.profession.ambushSource &&
      state.profession.ambushUntil > endTime + EPSILON
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
      MESMER_AUTOATTACK_CHAINS.map((chain) => [
        chain[0],
        state.profession.autoattackChains[chain[0]] || chain[0],
      ]),
    ),
    continuumActive: Boolean(state.profession.continuum),
    continuumRemaining: state.profession.continuum
      ? Math.max(
          0,
          Math.round((state.profession.continuum.expiresAt - endTime) * 1000),
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
    [TASK.bladeSpend]: handleBladeSpendTask,
    [TASK.continuumExpire]: handleContinuumExpiryTask,
    [TASK.infiniteForge]: handleInfiniteForgeTask,
    [TASK.signetEtherRelock]: handleSignetEtherRelockTask,
    [TASK.signetIllusionsPassive]: handleSignetIllusionsPassiveTask,
  }),
});
