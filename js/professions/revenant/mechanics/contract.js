import { REVENANT_AUTOATTACK_CHAINS } from "../catalog.js";
import { REVENANT_TRAIT_IDS as TRAIT } from "../data/ids.js";
import {
  hasRevenantTrait,
  snapshotRevenantState,
} from "../state.js";
import { revenantCastAvailability } from "./availability.js";

const CHAIN_BY_ID = new Map();
for (const chain of REVENANT_AUTOATTACK_CHAINS) {
  chain.forEach((id, index) => CHAIN_BY_ID.set(id, {
    root: chain[0],
    next: chain[index + 1] ?? null,
  }));
}
const FACET_CONSUME = Object.freeze({
  "Facet of Light": "Infuse Light",
  "Facet of Strength": "Burst of Strength",
  "Facet of Elements": "Elemental Blast",
  "Facet of Darkness": "Gaze of Darkness",
  "Facet of Chaos": "Chaotic Release",
  "Facet of Nature": "True Nature",
});
const FACET_BY_CONSUME = Object.freeze(
  Object.fromEntries(
    Object.entries(FACET_CONSUME).map(([facet, consume]) => [consume, facet]),
  ),
);
const RELEASE_BY_LEGEND = Object.freeze({
  LegendaryAssassin: "Release Potential: Assassin",
  LegendaryCentaur: "Release Potential: Monk",
  LegendaryDemon: "Release Potential: Dervish",
  LegendaryDwarf: "Release Potential: Warrior",
  LegendaryDragon: "Release Potential: Mesmer",
  LegendaryRenegade: "Release Potential: Warrior",
  LegendaryAlliance: "Release Potential: Dervish",
  LegendaryEntity: "Release Potential: Mesmer",
});

function emitState(context, at, reason) {
  context.emit({
    type: "revenant.state",
    at,
    source: "revenant",
    sourceId: `revenant.state.${reason}`,
    actorType: "player",
    reason,
    state: snapshotRevenantState(context.state.profession),
  });
}

export function advanceRevenantState(context, target) {
  const state = context.state.profession;
  const from = Number(state.energyUpdatedAt || 0);
  const enduranceFrom = Number(state.enduranceUpdatedAt || 0);
  if (target > enduranceFrom) {
    state.endurance = Math.min(
      state.maximumEndurance,
      state.endurance + (target - enduranceFrom) * 5,
    );
    state.enduranceUpdatedAt = target;
  }
  if (
    state.cosmicWisdomUntil > 0
    && target >= state.cosmicWisdomUntil
  ) {
    state.cosmicWisdomUntil = 0;
    state.conduitForm = "";
  }
  if (target <= from) return;
  const upkeep = state.activeUpkeeps.reduce(
    (sum, active) => sum + Number(active.upkeepCost || 0),
    0,
  );
  const rate = 5 - upkeep;
  const elapsed = target - from;
  if (rate < 0 && state.energy + rate * elapsed < 0) {
    const starvedAt = from + state.energy / -rate;
    state.energy = 0;
    state.activeUpkeeps = [];
    state.availableFlips = {};
    state.energyUpdatedAt = starvedAt;
    emitState(context, starvedAt, "upkeep-starved");
    state.energy = Math.min(state.maximumEnergy, (target - starvedAt) * 5);
    state.energyUpdatedAt = target;
    emitState(context, target, "energy");
    return;
  }
  state.energy = Math.max(
    0,
    Math.min(state.maximumEnergy, state.energy + elapsed * rate),
  );
  state.energyUpdatedAt = target;
  emitState(context, target, "energy");
}

function onCastStart(context, skill) {
  if (skill.id === -4) return;
  const state = context.state.profession;
  if (skill.id === -5) {
    const cost = context.config.specialization === "Vindicator" ? 100 : 50;
    state.endurance = Math.max(0, state.endurance - cost);
    emitState(context, context.start, "dodge");
    return;
  }
  const active = state.activeUpkeeps.some(upkeep => upkeep.skillId === skill.id);
  if (active) return;
  const cost = Number(skill.energyCost || 0);
  state.energy = Math.max(0, state.energy - cost);
  if (context.config.specialization === "Conduit" && cost > 0) {
    state.affinity = Math.min(5, state.affinity + 1);
  }
  if (cost > 0) emitState(context, context.start, "energy-spent");
}

function swapLegends(context, skill, at) {
  const state = context.state.profession;
  const previousEnergy = state.energy;
  const other = state.selectedLegendIds.find(id => id !== state.activeLegendId);
  state.activeLegendId = other || state.activeLegendId;
  state.activeLoadoutId = state.activeLegendId;
  state.legendSwapReadyAt = at + 10;
  state.energy = (
    previousEnergy < 10
    && hasRevenantTrait(context.config, TRAIT.CHARGED_MISTS)
  ) ? 75 : 50;
  state.energyUpdatedAt = at;
  state.activeUpkeeps = [];
  state.availableFlips = {};
  if (state.activeLegendId === "LegendaryAlliance") {
    state.allianceSide = context.config.allianceSide === "kurzick"
      ? "kurzick"
      : "luxon";
  }
  context.emit({
    type: "sigil_swap",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
  });
  emitState(context, at, "legend-swap");
}

function activateUpkeep(context, skill, at) {
  const state = context.state.profession;
  const index = state.activeUpkeeps.findIndex(upkeep =>
    upkeep.skillId === skill.id);
  if (index >= 0) {
    state.activeUpkeeps.splice(index, 1);
    const consumeName = FACET_CONSUME[skill.name];
    const consume = context.catalog.skillsByName.get(consumeName);
    if (consume) delete state.availableFlips[consume.id];
    context.tasks.cancelOwner(`revenant.upkeep:${skill.id}`);
    emitState(context, at, "upkeep-disabled");
    return;
  }
  state.activeUpkeeps.push({
    skillId: skill.id,
    upkeepCost: Number(skill.upkeepCost || 0),
  });
  const consumeName = FACET_CONSUME[skill.name];
  const consume = context.catalog.skillsByName.get(consumeName);
  if (consume) state.availableFlips[consume.id] = true;
  context.tasks.schedule({
    type: "revenant.upkeep-pulse",
    at: at + 1,
    ownerId: `revenant.upkeep:${skill.id}`,
    payload: { skillId: skill.id },
  });
  emitState(context, at, "upkeep-enabled");
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
  if (skill.id === -4) {
    swapLegends(context, skill, at);
    return;
  }
  if (Number(skill.upkeepCost) > 0) {
    activateUpkeep(context, skill, at);
  }
  const facetName = FACET_BY_CONSUME[skill.name];
  if (facetName) {
    const facet = context.catalog.skillsByName.get(facetName);
    state.activeUpkeeps = state.activeUpkeeps.filter(upkeep =>
      upkeep.skillId !== facet?.id);
    delete state.availableFlips[skill.id];
    if (facet) context.tasks.cancelOwner(`revenant.upkeep:${facet.id}`);
    emitState(context, at, "facet-consumed");
  }
  if (skill.name === "Ancient Echo") {
    state.energy = Math.min(state.maximumEnergy, state.energy + 25);
    emitState(context, at, "ancient-echo");
  }
  if (skill.name === "Alliance Tactics") {
    state.allianceSide = state.allianceSide === "luxon" ? "kurzick" : "luxon";
    emitState(context, at, "alliance-tactics");
  }
  if (skill.name.startsWith("Release Potential:")) {
    state.affinity = 0;
    emitState(context, at, "release-potential");
  }
  if (skill.name === "Cosmic Wisdom") {
    state.cosmicWisdomUntil = at + 7;
    state.conduitForm = RELEASE_BY_LEGEND[state.activeLegendId]
      ?.replace("Release Potential: ", "") || "";
    emitState(context, at, "cosmic-wisdom");
  }
}

function scheduleSkill(context, skill) {
  if (skill.id === -5) {
    const dodge = context.state.profession.selectedDodge;
    const coefficient = dodge === "Death Drop"
      ? 3
      : dodge === "Imperial Impact"
        ? 1
        : 0;
    if (coefficient > 0) {
      context.emit({
        type: "damage",
        at: context.start + 0.8,
        source: "revenant",
        sourceId: skill.id,
        actorType: "player",
        skillId: skill.id,
        skillName: dodge,
        name: dodge,
        coefficient,
        hits: 1,
        hitIndex: 1,
        totalHits: 1,
        skillWeapon: "Unequipped",
      });
    }
    return true;
  }
  return Number(skill.upkeepCost || 0) > 0;
}

function emitUpkeepEffects(context, skill, at) {
  for (const effect of skill.effects || []) {
    if (effect.type === "strike") {
      const hits = Math.max(1, Number(effect.hits || 1));
      for (let index = 0; index < hits; index += 1) {
        context.emit({
          type: "damage",
          at,
          source: "revenant",
          sourceId: skill.id,
          actorType: effect.actorType || "player",
          skillId: skill.id,
          skillName: skill.name,
          name: effect.name || skill.name,
          coefficient: Number(effect.coefficient || 0) / hits,
          hits: 1,
          hitIndex: index + 1,
          totalHits: hits,
          skillWeapon: "Unequipped",
        });
      }
    } else if (effect.type === "condition") {
      context.emit({
        type: "condition",
        at,
        source: "revenant",
        sourceId: skill.id,
        actorType: effect.actorType || "player",
        skillId: skill.id,
        skillName: skill.name,
        name: `${skill.name} — ${effect.condition}`,
        condition: effect.condition,
        stacks: effect.stacks,
        duration: effect.duration,
      });
    }
  }
}

function handleUpkeepPulse(context, task) {
  const state = context.state.profession;
  const active = state.activeUpkeeps.some(upkeep =>
    upkeep.skillId === task.payload.skillId);
  if (!active) return;
  const skill = context.catalog.skillsById.get(task.payload.skillId);
  if (
    skill
    && ["Vengeful Hammers", "Embrace the Darkness"].includes(skill.name)
  ) emitUpkeepEffects(context, skill, task.at);
  context.tasks.schedule({
    type: "revenant.upkeep-pulse",
    at: task.at + 1,
    ownerId: `revenant.upkeep:${task.payload.skillId}`,
    payload: task.payload,
  });
}

export const revenantCastRules = Object.freeze({
  availability: {
    id: "revenant.availability",
    order: 10,
    handler: revenantCastAvailability,
  },
  scheduleSkill,
});
export const revenantSchedulerHooks = Object.freeze({
  advance: advanceRevenantState,
  onCastStart,
  afterCast,
  taskHandlers: Object.freeze({
    "revenant.upkeep-pulse": handleUpkeepPulse,
  }),
});
