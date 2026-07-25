import { defineProfession } from "../../platform/engine/profession.js";
import { isGw2PlayerActorEvent } from "../../platform/gw2/event-ownership.js";
import {
  createGuardianBuildDefaults,
  migrateGuardianBuild,
  validateGuardianBuild,
} from "./build.js";
import {
  guardianAttributeRules,
  guardianCastModifiers,
} from "./attribute-rules.js";
import {
  guardianCatalog,
  GUARDIAN_SKILL_IDS,
} from "./catalog.js";
import { GUARDIAN_TRAIT_IDS } from "./ids.js";
import { GUARDIAN_AUTOATTACK_CHAINS } from "./mechanics.js";
import {
  createGuardianState,
  snapshotGuardianState,
} from "./state.js";

const CHAIN_POSITION_BY_SKILL_ID = new Map();
for (const chain of GUARDIAN_AUTOATTACK_CHAINS) {
  chain.forEach((skillId, index) => {
    CHAIN_POSITION_BY_SKILL_ID.set(skillId, {
      root: chain[0],
      next: chain[index + 1] ?? null,
    });
  });
}

function selectedSpecialization(config) {
  if (typeof config.specialization === "string") return config.specialization;
  return (config.specializations || [])
    .map(value => typeof value === "string" ? value : value?.name)
    .find(name =>
      guardianCatalog.specializations.some(spec =>
        spec.elite && spec.name === name)) || "";
}

function validateGuardianCast(context, skill) {
  if (!skill.implemented) return false;
  const specialization = selectedSpecialization(context.config) || "Core";
  if (
    skill.type !== "Weapon"
    && skill.specialization
    && specialization !== skill.specialization
  ) {
    return false;
  }
  if (skill.tome) {
    return specialization === "Firebrand"
      && context.state.profession.activeTome === skill.tome
      && context.state.profession.tomePages >= Number(skill.pageCost || 1);
  }
  if (skill.radiantForgeSkill && !context.state.profession.radiantForge) {
    return false;
  }
  if (
    skill.categories?.includes("Virtue")
    && /^Profession_[1-3]$/.test(String(skill.slot || ""))
  ) {
    const names = {
      Core: [
        "Virtue of Justice",
        "Virtue of Resolve",
        "Virtue of Courage",
      ],
      Dragonhunter: [
        "Spear of Justice",
        "Wings of Resolve",
        "Shield of Courage",
      ],
      Firebrand: [
        "Tome of Justice",
        "Tome of Resolve",
        "Tome of Courage",
      ],
      Willbender: [
        "Rushing Justice",
        "Flowing Resolve",
        "Crashing Courage",
      ],
      Luminary: [
        "Radiant Justice",
        "Radiant Resolve",
        "Radiant Courage",
      ],
    }[specialization] || [];
    if (!names.includes(skill.name)) return false;
  }
  if (skill.name === "Stow Tome") {
    return Boolean(context.state.profession.activeTome);
  }
  if (skill.name === "Enter Radiant Forge") {
    return specialization === "Luminary"
      && !context.state.profession.radiantForge;
  }
  if (skill.name === "Exit Radiant Forge") {
    return specialization === "Luminary"
      && context.state.profession.radiantForge;
  }
  if (skill.flipParentId != null) {
    return Number(
      context.state.profession.availableFlips[skill.id] || 0,
    ) > context.start + context.epsilon;
  }
  const chain = CHAIN_POSITION_BY_SKILL_ID.get(skill.id);
  if (!chain) return true;
  const expected =
    context.state.profession.autoattackChains[chain.root] || chain.root;
  return expected === skill.id;
}

function updateGuardianCastState(context, skill) {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const chain = CHAIN_POSITION_BY_SKILL_ID.get(skill.id);
  if (chain) {
    if (chain.next == null) {
      delete context.state.profession.autoattackChains[chain.root];
    } else {
      context.state.profession.autoattackChains[chain.root] = chain.next;
    }
  } else if (skill.type === "Weapon") {
    context.state.profession.autoattackChains = {};
  }

  if (
    skill.flipSkillId != null
    && skill.flipSkillId !== skill.nextChainId
  ) {
    const flip = guardianCatalog.skillsById.get(skill.flipSkillId);
    if (flip && flip.name !== skill.name) {
      const duration = skill.id === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME
        ? 3
        : Math.max(1, Number(skill.cooldown || skill.recharge || 5));
      context.state.profession.availableFlips[flip.id] =
        context.effectiveEnd + duration;
    }
  }
  if (skill.flipParentId != null) {
    delete context.state.profession.availableFlips[skill.id];
  }
}

function hasTrait(context, traitId) {
  return context.traits?.has(traitId)
    || context.traits?.has(String(traitId));
}

function applyJusticeBurn(
  context,
  event,
  applyCondition,
  {
    active,
  },
) {
  const sourceId = active
    ? "guardian.justice-active"
    : "guardian.justice-passive";
  applyCondition(context, {
    type: "condition",
    at: event.at,
    source: "guardian",
    sourceId,
    actorType: "player",
    skillId: GUARDIAN_SKILL_IDS.JUSTICE,
    skillName: "Virtue of Justice",
    name: `Virtue of Justice — ${active ? "Active" : "Passive"} Burning`,
    condition: "Burning",
    stacks: 1,
    duration: 2,
  });
  context.state.profession.justiceBurns += 1;
  if (active) context.state.profession.justiceActiveBurns += 1;
  else context.state.profession.justicePassiveBurns += 1;
  context.recordProc(
    "profession",
    active ? "Justice Active" : "Justice Passive",
    event.at,
    event.skillName,
  );
}

function handleVirtueActivation(context, event) {
  context.state.profession.virtueReadyAt[event.virtue] =
    Number(event.passiveReadyAt || event.at);
  if (
    event.virtue === "justice"
    && (event.specialization === "Core" || !event.specialization)
  ) {
    context.state.profession.justiceActiveArmed = true;
    context.state.profession.justiceArmed = true;
  }
}

function guardianProfessionSkillIds(context = {}) {
  const specialization =
    context.specialization
    || context.config?.specialization
    || "Core";
  const professionState =
    context.state?.profession
    || context.professionState
    || {};
  if (specialization === "Firebrand" && professionState.activeTome) {
    return guardianCatalog.skills
      .filter(skill =>
        skill.tome === professionState.activeTome
        || skill.name === "Stow Tome")
      .sort((left, right) =>
        String(left.slot).localeCompare(String(right.slot)))
      .map(skill => skill.id);
  }
  if (specialization === "Luminary" && professionState.radiantForge) {
    return guardianCatalog.skills
      .filter(skill =>
        skill.radiantForgeSkill
        || skill.name === "Exit Radiant Forge")
      .sort((left, right) =>
        String(left.slot).localeCompare(String(right.slot)))
      .map(skill => skill.id);
  }
  const names = {
    Core: [
      "Virtue of Justice",
      "Virtue of Resolve",
      "Virtue of Courage",
    ],
    Dragonhunter: [
      "Spear of Justice",
      "Wings of Resolve",
      "Shield of Courage",
    ],
    Firebrand: [
      "Tome of Justice",
      "Tome of Resolve",
      "Tome of Courage",
      "Stow Tome",
    ],
    Willbender: [
      "Rushing Justice",
      "Flowing Resolve",
      "Crashing Courage",
    ],
    Luminary: [
      "Radiant Justice",
      "Radiant Resolve",
      "Radiant Courage",
      "Enter Radiant Forge",
      "Exit Radiant Forge",
    ],
  }[specialization] || [];
  const skillIds = names
    .map(name => guardianCatalog.skillsByName.get(name)?.id)
    .filter(id => id != null);
  const activeFlips = context.state?.profession?.availableFlips
    || context.professionState?.availableFlips
    || {};
  return skillIds.flatMap(id => {
    const skill = guardianCatalog.skillsById.get(id);
    const flipId = skill?.flipSkillId;
    return (
      flipId != null
      && Number(activeFlips[flipId] || 0) > 0
    ) ? [id, flipId] : [id];
  });
}

function handleVirtueRefresh(context, event) {
  context.state.profession.virtueReadyAt = {
    justice: event.at,
    resolve: event.at,
    courage: event.at,
  };
}

function handleGuardianStateEvent() {
  // State transitions are applied by skill handlers during scheduling. The
  // resolver registration keeps the corresponding timeline events explicit.
}

function advanceGuardianState(context, target) {
  const state = context.state.profession;
  while (
    state.tomePages < state.maximumTomePages
    && state.nextTomePageAt <= target + context.epsilon
  ) {
    state.tomePages += 1;
    state.nextTomePageAt += state.tomePageInterval;
  }
  if (state.tomePages >= state.maximumTomePages) {
    state.nextTomePageAt = Number.POSITIVE_INFINITY;
  }
  if (
    state.radiantForge
    && state.radiantForgeEndsAt <= target + context.epsilon
  ) {
    state.radiantForge = false;
    state.radiantForgeEndsAt = 0;
    state.radiantWeapon = "";
    state.availableFlips = {};
  }
}

function reactToGuardianHit(
  context,
  event,
  {
    hitContext,
    applyCondition,
  } = {},
) {
  if (
    !hitContext
    || typeof applyCondition !== "function"
    || !isGw2PlayerActorEvent(event)
    || !(Number(event.coefficient) > 0)
  ) return;

  const state = context.state.profession;
  if (
    state.ashesCharges > 0
    && event.at + Number(context.epsilon || 0.0001)
      >= state.ashesNextTriggerAt
  ) {
    applyCondition(context, {
      type: "condition",
      at: event.at,
      source: "guardian",
      sourceId: "guardian.ashes-of-the-just",
      actorType: "player",
      skillId: GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST,
      skillName: "Epilogue: Ashes of the Just",
      name: "Ashes of the Just — Burning",
      condition: "Burning",
      stacks: 1,
      duration: 2,
    });
    state.ashesCharges -= 1;
    state.ashesNextTriggerAt = event.at + 1;
    context.recordProc(
      "profession",
      "Ashes of the Just",
      event.at,
      event.skillName,
    );
  }
  if (state.justiceActiveArmed) {
    state.justiceActiveArmed = false;
    state.justiceArmed = false;
    applyJusticeBurn(context, event, applyCondition, { active: true });
    return;
  }

  const retainsPassive = hasTrait(context, GUARDIAN_TRAIT_IDS.QUICKFIRE);
  if (
    !retainsPassive
    && event.at < Number(state.virtueReadyAt.justice || 0)
  ) return;

  state.justiceHitCount += 1;
  const triggerHits = hasTrait(
    context,
    GUARDIAN_TRAIT_IDS.PERMEATING_WRATH,
  ) ? 3 : 5;
  if (state.justiceHitCount < triggerHits) return;
  state.justiceHitCount = 0;
  applyJusticeBurn(context, event, applyCondition, { active: false });
}

export const guardianProfession = defineProfession({
  id: "guardian",
  name: "Guardian",
  catalog: guardianCatalog,
  build: {
    createBuildDefaults: createGuardianBuildDefaults,
    migrateBuild: migrateGuardianBuild,
    validateBuild: validateGuardianBuild,
  },
  resources: {
    createProfessionState: createGuardianState,
  },
  attributeRules: guardianAttributeRules,
  castRules: {
    validateCast: validateGuardianCast,
    ...guardianCastModifiers,
  },
  schedulerHooks: {
    advance: advanceGuardianState,
    afterCast: updateGuardianCastState,
    snapshot: context => snapshotGuardianState(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: {
      "guardian.virtue-activated": handleVirtueActivation,
      "guardian.virtues-refreshed": handleVirtueRefresh,
      "guardian.tome-stowed": handleGuardianStateEvent,
      "guardian.tome-page-used": handleGuardianStateEvent,
      "guardian.radiant-forge-entered": handleGuardianStateEvent,
      "guardian.radiant-forge-exited": handleGuardianStateEvent,
    },
    eventReactions: {
      damage: reactToGuardianHit,
    },
  },
  ui: {
    paletteGroups: context => [
      {
        id: "profession",
        label: "F",
        skillIds: guardianProfessionSkillIds(context),
        color: "#2f7eb8",
      },
      {
        id: "guardian-actions",
        label: "Act",
        skillIds: [GUARDIAN_SKILL_IDS.SWAP_WEAPONS],
        color: "#70b6d0",
      },
    ],
    resourceViews: context => {
      const specialization =
        context.specialization
        || context.config?.specialization
        || "Core";
      if (specialization !== "Firebrand") return [];
      const state =
        context.state?.profession
        || context.professionState
        || {};
      const maximum = Number(state.maximumTomePages || 5);
      return [{
        id: "pages",
        singular: "page",
        plural: "pages",
        maximum,
        value: Number(state.tomePages ?? maximum),
        canStart: false,
        shortLabel: "Pgs",
        statusLabel: "Current",
      }];
    },
  },
});

export default guardianProfession;
