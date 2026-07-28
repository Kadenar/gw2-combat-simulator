import { THIEF_AUTOATTACK_CHAINS } from "../catalog.js";
import {
  THIEF_ARTIFACT_IDS,
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import {
  hasThiefTrait,
  snapshotThiefState,
} from "../state.js";
import { thiefCastAvailability } from "./availability.js";

const CHAIN_BY_ID = new Map();
for (const chain of THIEF_AUTOATTACK_CHAINS) {
  chain.forEach((id, index) => CHAIN_BY_ID.set(id, {
    root: chain[0],
    next: chain[index + 1] ?? null,
  }));
}
const STEAL_ACTIONS = new Set([
  ID.STEAL,
  ID.DEADEYES_MARK,
  ID.SIPHON,
]);
const STOLEN_ID_BY_CHOICE = Object.freeze({
  "throw-gunk": ID.THROW_GUNK,
  "consume-plasma": ID.CONSUME_PLASMA,
  "whirling-axe": ID.WHIRLING_AXE,
});

function emitState(context, at, reason) {
  context.emit({
    type: "thief.state",
    at,
    source: "thief",
    sourceId: `thief.state.${reason}`,
    actorType: "player",
    reason,
    state: snapshotThiefState(context.state.profession),
  });
}
function emitBarSwap(context, skill, at) {
  context.emit({
    type: "sigil_swap",
    at,
    source: "thief",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
  });
}
function gainInitiative(context, amount, at, reason) {
  const state = context.state.profession;
  state.initiative = Math.min(
    state.maximumInitiative,
    state.initiative + Math.max(0, Number(amount || 0)),
  );
  emitState(context, at, reason);
}
function gainEndurance(context, amount, at, reason) {
  const state = context.state.profession;
  state.endurance = Math.min(
    state.maximumEndurance,
    state.endurance + Math.max(0, Number(amount || 0)),
  );
  emitState(context, at, reason);
}
function emitCondition(context, {
  at,
  condition,
  duration,
  stacks = 1,
  sourceId,
  name,
}) {
  context.emit({
    type: "condition",
    at,
    source: "Trait",
    sourceId,
    actorType: "player",
    skillId: context.skill?.id,
    skillName: context.skill?.name,
    name,
    condition,
    stacks,
    duration,
  });
}
function nextArtifact(state, kind) {
  const sequence = state.artifactOutcomeSequence[kind] || [];
  const index = Number(state.artifactOutcomeIndices[kind] || 0);
  const skillId = sequence[index % Math.max(1, sequence.length)] || (
    kind === "offensive"
      ? THIEF_ARTIFACT_IDS.OFFENSIVE[0]
      : THIEF_ARTIFACT_IDS.DEFENSIVE[0]
  );
  state.artifactOutcomeIndices[kind] = index + 1;
  return { kind, skillId };
}
function pilferArtifacts(context, at, reason = "pilfer") {
  const state = context.state.profession;
  const prolific = hasThiefTrait(context.config, TRAIT.PROLIFIC_PLUNDERER);
  state.artifactSlots = [
    nextArtifact(state, "offensive"),
    nextArtifact(state, "defensive"),
    ...(prolific ? [nextArtifact(state, "offensive")] : []),
  ];
  state.artifactUsesRemaining = prolific ? 2 : 1;
  state.initiativeSpentSincePilfer = 0;
  state.scoundrelsLuck = hasThiefTrait(
    context.config,
    TRAIT.SCOUNDRELS_LUCK,
  ) ? 1 : 0;
  emitState(context, at, reason);
}
function reshuffleArtifacts(context, at) {
  const state = context.state.profession;
  state.artifactSlots = state.artifactSlots.map(slot =>
    nextArtifact(state, slot.kind));
  emitState(context, at, "artifacts-reshuffled");
}
function nextDoubleEdgeOutcome(state) {
  if (state.scoundrelsLuck > 0) {
    state.scoundrelsLuck -= 1;
    return "success";
  }
  const sequence = state.doubleEdgeOutcomeSequence || ["success", "backfire"];
  const index = Number(state.doubleEdgeOutcomeIndex || 0);
  state.doubleEdgeOutcomeIndex = index + 1;
  return sequence[index % sequence.length] || "success";
}

export function advanceThiefState(context, target) {
  const state = context.state.profession;
  if (state.leadAttacksUntil > 0 && target >= state.leadAttacksUntil) {
    state.leadAttacksStacks = 0;
    state.leadAttacksUntil = 0;
  }
  state.activeAntiquarySummons = state.activeAntiquarySummons.filter(
    summon => Number(summon.expiresAt || 0) > target,
  );
  if (
    state.activeThievesGuild
    && Number(state.activeThievesGuild.expiresAt || 0) <= target
  ) {
    state.activeThievesGuild = null;
  }
  for (const [skillId, penalty] of Object.entries(state.backfireState)) {
    if (Number(penalty.activeUntil || 0) <= target) {
      delete state.backfireState[skillId];
    }
  }
  for (const [skillId, expiresAt] of Object.entries(state.availableFlips)) {
    if (Number(expiresAt || 0) <= target) delete state.availableFlips[skillId];
  }
  const initiativeFrom = Number(state.initiativeUpdatedAt || 0);
  if (target > initiativeFrom) {
    state.initiative = Math.min(
      state.maximumInitiative,
      state.initiative + (target - initiativeFrom),
    );
    state.initiativeUpdatedAt = target;
  }
  const enduranceFrom = Number(state.enduranceUpdatedAt || 0);
  if (target > enduranceFrom) {
    state.endurance = Math.min(
      state.maximumEndurance,
      state.endurance + (target - enduranceFrom) * 5,
    );
    state.enduranceUpdatedAt = target;
  }
  const shadowFrom = Number(state.shadowForceUpdatedAt || 0);
  if (target > shadowFrom && state.shadowShroudActive) {
    state.shadowForce = Math.max(
      0,
      state.shadowForce - (target - shadowFrom) * 2,
    );
    if (state.shadowForce === 0) {
      state.shadowShroudActive = false;
      emitState(context, target, "shadow-shroud-depleted");
    }
  }
  state.shadowForceUpdatedAt = target;
  emitState(context, target, "resources");
}

function onCastStart(context, skill) {
  const state = context.state.profession;
  const cost = Number(skill.initiativeCost || 0);
  if (cost > 0) {
    state.initiative = Math.max(0, state.initiative - cost);
    if (context.config.specialization === "Specter") {
      state.shadowForce = Math.min(
        state.maximumShadowForce,
        state.shadowForce + cost * 1.5,
      );
    }
    state.initiativeSpentSincePilfer += cost;
    if (hasThiefTrait(context.config, TRAIT.LEAD_ATTACKS)) {
      state.leadAttacksStacks = Math.min(
        15,
        Number(state.leadAttacksStacks || 0) + cost,
      );
      state.leadAttacksUntil = context.start + 15;
    }
    if (
      context.config.specialization === "Daredevil"
      && skill.weapon === "Staff"
      && hasThiefTrait(context.config, TRAIT.STAFF_MASTER)
    ) {
      gainEndurance(context, cost * 2, context.start, "staff-master");
    }
    emitState(context, context.start, "initiative-spent");
    if (
      context.config.specialization === "Antiquary"
      && hasThiefTrait(context.config, TRAIT.PRODIGIOUS_PINCHER)
      && state.initiativeSpentSincePilfer >= 15
    ) {
      pilferArtifacts(context, context.start, "prodigious-pincher");
    }
  }
  if (skill.stealthAttack) {
    if (hasThiefTrait(context.config, TRAIT.SHADOWS_REJUVENATION)) {
      gainInitiative(context, 1, context.start, "leave-stealth");
    }
    state.stealthUntil = context.start;
    state.revealedUntil = context.start + 3;
    emitState(context, context.start, "stealth-attack");
  }
  if (skill.id === -5) {
    state.endurance = Math.max(0, state.endurance - 50);
    emitState(context, context.start, "dodge");
    if (state.selectedDodge === "Bounding Dodger") {
      state.boundingDamageUntil = context.start + 4;
    }
  }
  if (
    (skill.categories || []).some(category =>
      String(category).toLowerCase().includes("signet"))
    && hasThiefTrait(context.config, TRAIT.SIGNETS_OF_POWER)
  ) {
    gainInitiative(context, 2, context.start, "signets-of-power");
  }
  if (
    (skill.categories || []).some(category =>
      String(category).toLowerCase().includes("physical"))
    && hasThiefTrait(context.config, TRAIT.BRAWLERS_TENACITY)
  ) {
    gainEndurance(context, 10, context.start, "brawlers-tenacity");
  }
}

function selectedStolenSkill(context) {
  const choice =
    context.config.deterministicChoices?.stolenSkillChoice
    || "throw-gunk";
  return STOLEN_ID_BY_CHOICE[choice] || ID.THROW_GUNK;
}

function enterStealthFromSkill(context, skill, at) {
  const duration = (skill.effects || [])
    .filter(effect =>
      effect.type === "buff" && effect.kind === "stealth")
    .reduce((sum, effect) => sum + Number(effect.duration || 0), 0);
  if (!(duration > 0)) return;
  const state = context.state.profession;
  if (state.revealedUntil > at) return;
  const entering = state.stealthUntil <= at;
  state.stealthUntil = Math.min(
    at + 15,
    Math.max(at, state.stealthUntil) + duration,
  );
  if (
    entering
    && hasThiefTrait(context.config, TRAIT.SHADOWS_REJUVENATION)
  ) {
    gainInitiative(context, 1, at, "enter-stealth");
  }
  emitState(context, at, "stealth");
}

function afterCast(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const chain = CHAIN_BY_ID.get(skill.id);
  if (chain) {
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (skill.type === "Weapon") {
    state.autoattackChains = {};
  }
  enterStealthFromSkill(context, skill, at);
  if (skill.dualWieldOpener && skill.flipSkillId != null) {
    state.availableFlips[skill.flipSkillId] = at + 4;
    emitState(context, at, "dual-wield-follow-up");
  }
  if (skill.dualWieldFollowup) {
    delete state.availableFlips[skill.id];
    emitState(context, at, "dual-wield-follow-up-used");
  }

  if (STEAL_ACTIONS.has(skill.id)) {
    state.storedStolenSkillId = selectedStolenSkill(context);
    if (skill.id === ID.DEADEYES_MARK) {
      state.markedTargetId = "primary-target";
      state.malice = hasThiefTrait(
        context.config,
        TRAIT.MALICIOUS_INTENT,
      ) ? 1 : 0;
      state.maleficentSevenTriggered = false;
    }
    if (skill.id === ID.SIPHON) {
      state.shadowForce = Math.min(
        state.maximumShadowForce,
        state.shadowForce + (
          hasThiefTrait(context.config, TRAIT.AMPLIFIED_SIPHONING)
            ? 35
            : 25
        ),
      );
    }
    if (hasThiefTrait(context.config, TRAIT.KLEPTOMANIAC)) {
      gainInitiative(context, 2, at, "kleptomaniac");
    }
    if (hasThiefTrait(context.config, TRAIT.ENDURANCE_THIEF)) {
      gainEndurance(context, 25, at, "endurance-thief");
    }
    emitState(context, at, "steal");
  } else if (skill.id === ID.SKRITT_SWIPE) {
    pilferArtifacts(context, at);
    if (hasThiefTrait(context.config, TRAIT.KLEPTOMANIAC)) {
      gainInitiative(context, 2, at, "kleptomaniac");
    }
  } else if (skill.id === state.storedStolenSkillId) {
    state.storedStolenSkillId = null;
    emitState(context, at, "stolen-skill-used");
  }

  if (
    context.config.specialization === "Deadeye"
    && state.markedTargetId
    && skill.type === "Weapon"
    && Number(skill.initiativeCost || 0) > 0
    && !skill.stealthAttack
  ) {
    state.malice = Math.min(state.maximumMalice, state.malice + 1);
    if (
      state.malice === state.maximumMalice
      && !state.maleficentSevenTriggered
      && hasThiefTrait(context.config, TRAIT.MALEFICENT_SEVEN)
    ) {
      state.maleficentSevenTriggered = true;
      gainInitiative(context, 7, at, "maleficent-seven");
    }
    emitState(context, at, "malice");
  }
  if (skill.stealthAttack && skill.malicious) {
    state.malice = 0;
    state.maleficentSevenTriggered = false;
    emitState(context, at, "malice-spent");
  }
  if (
    skill.stealthAttack
    && hasThiefTrait(context.config, TRAIT.HIDDEN_THIEF)
  ) {
    emitCondition(context, {
      at,
      condition: "Weakness",
      duration: 5,
      sourceId: TRAIT.HIDDEN_THIEF,
      name: "Hidden Thief — Weakness",
    });
  }
  if (
    skill.stealthAttack
    && hasThiefTrait(context.config, TRAIT.SUNDERING_SHADE)
  ) {
    emitCondition(context, {
      at,
      condition: "Vulnerability",
      duration: 8,
      stacks: 5,
      sourceId: TRAIT.SUNDERING_SHADE,
      name: "Sundering Shade — Vulnerability",
    });
  }
  if (
    skill.requiredMainHand
    && skill.requiredOffHand != null
    && hasThiefTrait(context.config, TRAIT.DEADLY_AMBITION)
  ) {
    emitCondition(context, {
      at,
      condition: "Poisoned",
      duration: 6,
      stacks: 2,
      sourceId: TRAIT.DEADLY_AMBITION,
      name: "Deadly Ambition — Poison",
    });
  }
  if (skill.artifactKind) {
    state.artifactUsesRemaining = Math.max(
      0,
      state.artifactUsesRemaining - 1,
    );
    state.artifactSlots = state.artifactSlots.filter(
      slot => slot.skillId !== skill.id,
    );
    if (hasThiefTrait(context.config, TRAIT.ENTERPRISING_ARISTOCRAT)) {
      gainInitiative(context, 2, at, "enterprising-aristocrat");
    }
    if (
      hasThiefTrait(context.config, TRAIT.EXHILARATING_EPHEMERA)
      || hasThiefTrait(context.config, TRAIT.COMBAT_HIGH)
    ) {
      state.antiquaryDamageUntil = Math.max(
        state.antiquaryDamageUntil,
        at + 10,
      );
    }
    emitState(context, at, "artifact-used");
  }
  if (skill.id === ID.RESHUFFLE) reshuffleArtifacts(context, at);
  if (skill.doubleEdge) {
    const outcome = nextDoubleEdgeOutcome(state);
    if (outcome === "backfire") {
      state.backfireState[skill.id] = {
        activeUntil: at + Math.max(0, Number(skill.cooldown || 0)),
        skillName: skill.name,
      };
    } else {
      delete state.backfireState[skill.id];
    }
    if (
      skill.name === "Skritt Scuffle"
      && outcome === "success"
    ) {
      const summon = {
        skillId: skill.id,
        name: "Skritt Assistant",
        expiresAt: at + 30,
      };
      state.activeAntiquarySummons.push(summon);
      context.tasks.schedule({
        type: "thief.skritt-scuffle",
        at: at + 5,
        ownerId: `thief.skritt-scuffle:${skill.id}`,
        payload: { expiresAt: summon.expiresAt },
      });
    }
    emitState(context, at, `double-edge-${outcome}`);
  }
  if (skill.name === "Thieves Guild") {
    const variant = {
      Daredevil: "Daredevil",
      Deadeye: "Deadeye",
      Specter: "Specter",
      Antiquary: "Skritt",
    }[context.config.specialization] || "Core Thief";
    state.activeThievesGuild = {
      variant,
      expiresAt: at + 30,
    };
    context.tasks.cancelOwner("thief.thieves-guild");
    context.tasks.schedule({
      type: "thief.thieves-guild-attack",
      at: at + 1,
      ownerId: "thief.thieves-guild",
      payload: { expiresAt: at + 30, variant },
    });
    emitState(context, at, "thieves-guild");
  }
  if (skill.id === ID.SWAP_WEAPONS) {
    context.state.activeWeaponSet =
      context.state.activeWeaponSet === 1 ? 2 : 1;
    context.emit({
      type: "weapon_set",
      at,
      source: "thief",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      weaponSet: context.state.activeWeaponSet,
    });
  }
  if (skill.id === ID.KNEEL) {
    state.kneeling = true;
    emitState(context, at, "kneel");
  } else if (skill.id === ID.FREE_ACTION || skill.id === ID.SWAP_WEAPONS) {
    state.kneeling = false;
    emitState(context, at, "stand");
  }
  if (
    skill.id === ID.SWAP_WEAPONS
    && hasThiefTrait(context.config, TRAIT.QUICK_POCKETS)
  ) {
    gainInitiative(context, 3, at, "quick-pockets");
  }
  if (
    skill.id === -5
    && hasThiefTrait(context.config, TRAIT.UPPER_HAND)
  ) {
    gainInitiative(context, 1, at, "upper-hand");
  }
  if (skill.id === ID.ENTER_SHADOW_SHROUD) {
    state.shadowShroudActive = true;
    state.shadowForceUpdatedAt = at;
    emitBarSwap(context, skill, at);
    emitState(context, at, "enter-shadow-shroud");
  } else if (skill.id === ID.EXIT_SHADOW_SHROUD) {
    state.shadowShroudActive = false;
    emitBarSwap(context, skill, at);
    emitState(context, at, "exit-shadow-shroud");
  }
}

function scheduleSkill(context, skill) {
  if (STEAL_ACTIONS.has(skill.id) || skill.id === ID.SKRITT_SWIPE) {
    const at = context.effectiveEnd;
    if (hasThiefTrait(context.config, TRAIT.SERPENTS_TOUCH)) {
      emitCondition(context, {
        at,
        condition: "Poisoned",
        duration: 6,
        stacks: 2,
        sourceId: TRAIT.SERPENTS_TOUCH,
        name: "Serpent's Touch — Poison",
      });
    }
    if (hasThiefTrait(context.config, TRAIT.EVEN_THE_ODDS)) {
      emitCondition(context, {
        at,
        condition: "Vulnerability",
        duration: 10,
        stacks: 5,
        sourceId: TRAIT.EVEN_THE_ODDS,
        name: "Even the Odds — Vulnerability",
      });
    }
    if (hasThiefTrait(context.config, TRAIT.DEADLY_AMBUSH)) {
      emitCondition(context, {
        at,
        condition: "Bleeding",
        duration: 8,
        stacks: 3,
        sourceId: TRAIT.DEADLY_AMBUSH,
        name: "Deadly Ambush — Bleeding",
      });
    }
  }
  if (skill.id !== -5) return false;
  const dodge = context.state.profession.selectedDodge;
  if (dodge === "Bounding Dodger") {
    context.emit({
      type: "damage",
      at: context.start + 0.8,
      source: "thief",
      sourceId: TRAIT.BOUNDING_DODGER,
      actorType: "player",
      skillId: skill.id,
      skillName: dodge,
      name: dodge,
      coefficient: 1.33,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      skillWeapon: "Unequipped",
    });
  } else if (dodge === "Lotus Training") {
    for (const condition of ["Bleeding", "Torment", "Crippled"]) {
      context.emit({
        type: "condition",
        at: context.start + 0.8,
        source: "Trait",
        sourceId: TRAIT.LOTUS_TRAINING,
        actorType: "player",
        skillId: skill.id,
        skillName: dodge,
        name: `${dodge} — ${condition}`,
        condition,
        stacks: 1,
        duration: condition === "Crippled" ? 2 : 4,
      });
    }
  } else if (dodge === "Unhindered Combatant") {
    context.emit({
      type: "boon",
      at: context.start + 0.8,
      source: "Trait",
      sourceId: TRAIT.UNHINDERED_COMBATANT,
      actorType: "player",
      skillId: skill.id,
      skillName: dodge,
      name: `${dodge} — Swiftness`,
      boon: "Swiftness",
      stacks: 1,
      duration: 8,
    });
  }
  return true;
}

function handleThievesGuildAttack(context, task) {
  if (task.at > Number(task.payload.expiresAt || 0)) return;
  context.emit({
    type: "damage",
    at: task.at,
    source: "thief",
    sourceId: "thief.thieves-guild",
    actorType: "summon",
    skillName: `Thieves Guild — ${task.payload.variant}`,
    name: `Thieves Guild — ${task.payload.variant}`,
    coefficient: 1.2,
    hits: 3,
    hitIndex: 1,
    totalHits: 3,
    skillWeapon: "Unequipped",
  });
  context.tasks.schedule({
    ...task,
    at: task.at + 1,
  });
}

function handleSkrittScuffle(context, task) {
  if (task.at > Number(task.payload.expiresAt || 0)) return;
  pilferArtifacts(context, task.at, "skritt-scuffle-artifact");
  context.tasks.schedule({
    ...task,
    at: task.at + 5,
  });
}

export const thiefCastRules = Object.freeze({
  availability: {
    id: "thief.availability",
    order: 10,
    handler: thiefCastAvailability,
  },
  scheduleSkill,
});
export const thiefSchedulerHooks = Object.freeze({
  advance: advanceThiefState,
  onCastStart,
  afterCast,
  taskHandlers: Object.freeze({
    "thief.thieves-guild-attack": handleThievesGuildAttack,
    "thief.skritt-scuffle": handleSkrittScuffle,
  }),
});
