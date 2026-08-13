import { criticalChance } from "../../../platform/gw2/damage.js";
import { hasTrait as hasGw2Trait } from "../../../platform/gw2/trait-state.js";
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_OVERLOAD_SKILL_IDS,
} from "../data/ids.js";
export { elementalistCoreAttributeRules } from "./modifiers.js";
import type {
  AvailabilityResult,
  CastContext,
  CastLifecycleContext,
  SchedulerContext,
  SchedulerRecord,
  SimulationEvent,
  Skill,
} from "../../../platform/engine/types.js";
import {
  ELEMENTALIST_ATTUNEMENTS,
  elementalistCoreState,
  resetElementalistAttunementCooldowns,
  setElementalistAttunementReadyAt,
  type ElementalistAttunement,
  type ElementalistAuraState,
  type ElementalistCoreState,
} from "./state.js";

const ATTUNEMENT_RECHARGE_SECONDS = 10;
const OFF_ATTUNEMENT_RECHARGE_SECONDS = 1.5;
const WEAVER_ATTUNEMENT_RECHARGE_SECONDS = 4;
const DODGE_ENDURANCE_COST = 50;
const ENDURANCE_PER_SECOND = 5;
const AUTOATTACK_CHAIN_PRESERVING_SKILLS = new Set([
  "Ride the Lightning",
  "Relentless Fire",
]);

const HAMMER_ORB_SKILLS: Readonly<Record<string, ElementalistAttunement>> =
  Object.freeze({
    "Flame Wheel": "Fire",
    "Icy Coil": "Water",
    "Crescent Wind": "Air",
    "Rocky Loop": "Earth",
  });
const HAMMER_DUAL_ORB_SKILLS: Readonly<
  Record<string, readonly ElementalistAttunement[]>
> = Object.freeze({
  "Dual Orbits: Fire and Water": ["Fire", "Water"],
  "Dual Orbits: Fire and Air": ["Fire", "Air"],
  "Dual Orbits: Fire and Earth": ["Fire", "Earth"],
  "Dual Orbits: Water and Air": ["Water", "Air"],
  "Dual Orbits: Water and Earth": ["Water", "Earth"],
  "Dual Orbits: Air and Earth": ["Air", "Earth"],
});
const PISTOL_SKILL_ELEMENTS: Readonly<Record<string, ElementalistAttunement>> =
  Object.freeze({
    "Raging Ricochet": "Fire",
    "Frigid Flurry": "Water",
    "Dazing Discharge": "Air",
    "Shattering Stone": "Earth",
    "Searing Salvo": "Fire",
    "Frozen Fusillade": "Water",
    "Aerial Agility": "Air",
    "Aerial Agility (chain)": "Air",
    "Aerial Agility (dash)": "Air",
    "Boulder Blast": "Earth",
  });
const PISTOL_DUAL_ELEMENTS: Readonly<
  Record<string, readonly ElementalistAttunement[]>
> = Object.freeze({
  "Frostfire Flurry": ["Fire", "Water"],
  "Purblinding Plasma": ["Fire", "Air"],
  "Molten Meteor": ["Fire", "Earth"],
  "Flowing Finesse": ["Water", "Air"],
  "Echoing Erosion": ["Water", "Earth"],
  "Enervating Earth": ["Air", "Earth"],
});
const PISTOL_NO_CONSUME = new Set([
  "Aerial Agility",
  "Aerial Agility (chain)",
  "Aerial Agility (dash)",
]);
const PISTOL_NO_GRANT = new Set([
  "Aerial Agility (chain)",
  "Aerial Agility (dash)",
]);

type ElementalistCastContext = CastContext<ElementalistRuntimeState>;
type ElementalistLifecycleContext =
  CastLifecycleContext<ElementalistRuntimeState>;
type ElementalistSchedulerContext = SchedulerContext<ElementalistRuntimeState>;

interface ElementalistRuntimeState extends SchedulerRecord {
  core: ElementalistCoreState;
  specialization: {
    kind: string;
    state: SchedulerRecord;
  };
}

function hasTrait(context: unknown, trait: string): boolean {
  return hasGw2Trait(context as never, trait);
}

function ready(): AvailabilityResult {
  return { ready: true };
}

function unavailable(
  skill: Skill,
  code: string,
  reason: string,
  retryAt: number | null = null,
): AvailabilityResult {
  return {
    ready: false,
    retryAt,
    code,
    reason: `${skill.name} is unavailable — ${reason}`,
  };
}

function specialization(context: ElementalistCastContext): string {
  return String(context.config.specialization || "Core");
}

function targetAttunement(skill: Skill): ElementalistAttunement | null {
  const candidate = skill.name.replace(/ Attunement$/, "");
  return ELEMENTALIST_ATTUNEMENTS.includes(candidate as ElementalistAttunement)
    ? (candidate as ElementalistAttunement)
    : null;
}

function selectedSkillNames(context: ElementalistCastContext): Set<string> {
  const selected = context.config.selectedSkills;
  const values = Array.isArray(selected)
    ? selected
    : selected && typeof selected === "object"
      ? Object.values(selected as Readonly<Record<string, string>>)
      : [];
  return new Set(values.map(String));
}

function attunementVariantBaseName(name: string): string {
  return name.replace(/\s*\((?:Fire|Water|Air|Earth)\)$/, "");
}

function isSelectedSlotSkill(
  skill: Skill,
  selected: ReadonlySet<string>,
): boolean {
  if (selected.has(skill.name)) return true;
  if (!skill.attunement) return false;
  const baseName = attunementVariantBaseName(skill.name);
  return (
    baseName !== skill.name &&
    [...selected].some(
      (selectedName) => attunementVariantBaseName(selectedName) === baseName,
    )
  );
}

function shareAttunementVariantRecharge(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  if (
    !["Heal", "Utility", "Elite"].includes(String(skill.type)) ||
    !skill.attunement
  ) {
    return;
  }
  const baseName = attunementVariantBaseName(skill.name);
  if (baseName === skill.name) return;
  const readyAt = context.state.cooldowns.get(skill.id);
  const ammo = context.state.ammo.get(skill.id);
  if (readyAt == null && !ammo) return;
  for (const candidate of context.catalog.skills) {
    if (
      candidate.type === skill.type &&
      attunementVariantBaseName(candidate.name) === baseName
    ) {
      if (readyAt != null) context.state.cooldowns.set(candidate.id, readyAt);
      if (ammo) context.state.ammo.set(candidate.id, ammo);
    }
  }
}

function slotNumber(skill: Skill): number {
  return Number(String(skill.slot || "").match(/(\d+)$/)?.[1] || 0);
}

function sameElements(
  required: readonly string[],
  active: readonly (string | null)[],
): boolean {
  return (
    required.length === active.length &&
    required.every((element) => active.includes(element))
  );
}

function weaponAttunementAvailable(
  context: ElementalistCastContext,
  skill: Skill,
  state: ElementalistCoreState,
): AvailabilityResult {
  const attunement = String(skill.attunement || "");
  if (!attunement) return ready();
  const required = attunement.split("+");
  if (specialization(context) !== "Weaver") {
    return required.length === 1 && required[0] === state.primaryAttunement
      ? ready()
      : unavailable(
          skill,
          "elementalist.attunement",
          `requires ${attunement} attunement.`,
        );
  }

  const secondary = state.secondaryAttunement || state.primaryAttunement;
  const slot = slotNumber(skill);
  const available =
    required.length > 1
      ? slot === 3 &&
        sameElements(required, [state.primaryAttunement, secondary])
      : slot <= 2
        ? required[0] === state.primaryAttunement
        : slot >= 4
          ? required[0] === secondary
          : state.primaryAttunement === secondary &&
            required[0] === state.primaryAttunement;
  return available
    ? ready()
    : unavailable(
        skill,
        "elementalist.weaver-attunement",
        `requires ${attunement} in the matching Weaver hand.`,
      );
}

function autoattackChainAvailability(
  context: ElementalistCastContext,
  skill: Skill,
  state: ElementalistCoreState,
): AvailabilityResult | null {
  const position = context.catalog.autoattackChainPositions.get(
    Number(skill.id),
  );
  if (!position) return null;
  const expected =
    Number(state.autoattackChains[position.root]) || position.root;
  if (expected !== Number(skill.id)) {
    const expectedSkill = context.catalog.skillsById.get(expected);
    return unavailable(
      skill,
      "elementalist.autoattack-chain",
      `cast ${expectedSkill?.name || "the earlier chain skill"} first.`,
    );
  }
  const carryover = state.autoattackCarryover;
  return carryover?.root === position.root &&
    carryover.attunement === skill.attunement
    ? ready()
    : null;
}

function progressedAutoattackCarryover(
  context: ElementalistLifecycleContext,
  state: ElementalistCoreState,
  attunement: ElementalistAttunement,
): ElementalistCoreState["autoattackCarryover"] {
  for (const [rawRoot, rawExpected] of Object.entries(state.autoattackChains)) {
    const root = Number(rawRoot);
    if (Number(rawExpected) === root) continue;
    const rootSkill = context.catalog.skillsById.get(root);
    if (rootSkill?.attunement === attunement) {
      return { root, attunement };
    }
  }
  return null;
}

function inFlightAutoattackCarryover(
  context: ElementalistLifecycleContext,
  attunement: ElementalistAttunement,
): ElementalistCoreState["pendingAutoattackCarryover"] {
  for (const skillId of context.inFlight.keys()) {
    const position = context.catalog.autoattackChainPositions.get(
      Number(skillId),
    );
    const skill = context.catalog.skillsById.get(Number(skillId));
    if (position && skill?.attunement === attunement) {
      return { root: position.root, attunement };
    }
  }
  return null;
}

function updateAutoattackChainState(
  context: ElementalistLifecycleContext,
  skill: Skill,
  state: ElementalistCoreState,
): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const position = context.catalog.autoattackChainPositions.get(
    Number(skill.id),
  );
  if (position) {
    const pending = state.pendingAutoattackCarryover;
    const pendingMatches =
      pending?.root === position.root &&
      pending.attunement === skill.attunement &&
      pending.attunement !== state.primaryAttunement;
    if (pendingMatches) state.autoattackCarryover = pending;
    state.pendingAutoattackCarryover = null;

    const carryoverRoot = state.autoattackCarryover?.root;
    if (carryoverRoot != null && carryoverRoot !== position.root) {
      delete state.autoattackChains[carryoverRoot];
      state.autoattackCarryover = null;
    }
    for (const rawRoot of Object.keys(state.autoattackChains)) {
      const root = Number(rawRoot);
      if (root !== position.root) delete state.autoattackChains[root];
    }
    if (position.next == null) {
      delete state.autoattackChains[position.root];
      if (state.autoattackCarryover?.root === position.root) {
        state.autoattackCarryover = null;
      }
    } else {
      state.autoattackChains[position.root] = position.next;
    }
    return;
  }
  if (
    Number(skill.castTimeMs || 0) > 0 &&
    !AUTOATTACK_CHAIN_PRESERVING_SKILLS.has(skill.name)
  ) {
    state.autoattackChains = {};
    state.autoattackCarryover = null;
    state.pendingAutoattackCarryover = null;
  }
}

function updateEndurance(
  state: ElementalistCoreState,
  at: number,
  vigor: boolean,
): void {
  const elapsed = Math.max(0, at - state.enduranceUpdatedAt);
  state.endurance = Math.min(
    100,
    state.endurance + elapsed * ENDURANCE_PER_SECOND * (vigor ? 1.5 : 1),
  );
  state.enduranceUpdatedAt = at;
}

export function elementalistCoreAvailability(
  context: ElementalistCastContext,
  skill: Skill,
): AvailabilityResult {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const target = targetAttunement(skill);
  if (target) {
    if (
      specialization(context) === "Evoker" &&
      hasTrait(context, "Specialized Elements")
    ) {
      return unavailable(
        skill,
        "elementalist.specialized-elements",
        "attunement swapping is disabled by Specialized Elements.",
      );
    }
    if (
      target === state.primaryAttunement &&
      (specialization(context) !== "Weaver" ||
        target === state.secondaryAttunement)
    ) {
      return unavailable(
        skill,
        "elementalist.same-attunement",
        `already attuned to ${target}.`,
      );
    }
    const readyAt = Number(state.attunementReadyAt[target] || 0);
    return readyAt > context.start + context.epsilon
      ? unavailable(
          skill,
          "elementalist.attunement-recharge",
          `${target} recharges at ${readyAt.toFixed(3)}.`,
          readyAt,
        )
      : ready();
  }

  if (skill.name === "Dodge") {
    updateEndurance(state, context.start, Boolean(context.config.boons?.vigor));
    return state.endurance + context.epsilon >= DODGE_ENDURANCE_COST
      ? ready()
      : unavailable(
          skill,
          "elementalist.endurance",
          `requires ${DODGE_ENDURANCE_COST} endurance.`,
          context.start +
            (DODGE_ENDURANCE_COST - state.endurance) /
              (ENDURANCE_PER_SECOND * (context.config.boons?.vigor ? 1.5 : 1)),
        );
  }

  if (["Heal", "Utility", "Elite"].includes(String(skill.type))) {
    const selected = selectedSkillNames(context);
    const selectedChainSkill =
      skill.name === "Tailored Victory" && selected.has("Weave Self");
    if (!isSelectedSlotSkill(skill, selected) && !selectedChainSkill) {
      return unavailable(
        skill,
        "elementalist.not-equipped",
        "the skill is not equipped.",
      );
    }
  }

  if (skill.type === "Weapon") {
    const chainAvailability = autoattackChainAvailability(
      context,
      skill,
      state,
    );
    if (chainAvailability) return chainAvailability;
    return weaponAttunementAvailable(context, skill, state);
  }
  if (
    skill.attunement &&
    !String(skill.attunement).includes("+") &&
    skill.type !== "Profession"
  ) {
    return String(skill.attunement) === state.primaryAttunement
      ? ready()
      : unavailable(
          skill,
          "elementalist.attuned-utility",
          `requires ${String(skill.attunement)} attunement.`,
        );
  }
  if (skill.name === "Grand Finale") {
    const active = Object.values(state.hammerOrbs).some(
      (expiresAt) => expiresAt != null && expiresAt >= context.start,
    );
    if (!active) {
      return unavailable(
        skill,
        "elementalist.hammer-orbs",
        "requires at least one active Hammer orb.",
      );
    }
  }
  return ready();
}

function alacrityAdjusted(
  context: ElementalistLifecycleContext,
  seconds: number,
): number {
  return context.config.boons?.alacrity ? seconds / 1.25 : seconds;
}

function attunementRechargeSeconds(
  context: ElementalistLifecycleContext,
  seconds: number,
): number {
  let adjusted = seconds;
  if (hasTrait(context, "Flow State")) adjusted = Math.max(0, adjusted - 1);
  if (hasTrait(context, "Elemental Enchantment")) adjusted *= 0.85;
  return adjusted;
}

function emitBuff(
  context: ElementalistSchedulerContext,
  at: number,
  kind: string,
  stacks: number,
  duration: number,
  source: string,
  sourceId: Skill["id"],
): void {
  context.emit({
    type: "buff",
    at,
    source,
    sourceId,
    actorType: "player",
    kind: kind.toLowerCase(),
    stacks,
    duration,
    skillName: source,
  });
}

function emitCondition(
  context: ElementalistSchedulerContext,
  at: number,
  condition: string,
  stacks: number,
  duration: number,
  source: string,
  sourceId: Skill["id"],
): void {
  context.emit({
    type: "condition",
    at,
    source,
    sourceId,
    actorType: "player",
    condition,
    stacks,
    duration,
    skillName: source,
  });
}

function evokerTraitProcReady(
  context: ElementalistSchedulerContext,
  state: ElementalistCoreState,
  key: string,
  at: number,
): boolean {
  if (String(context.config.specialization || "Core") !== "Evoker") return true;
  if (Number(state.procReadyAt[key] || 0) > at + context.epsilon) return false;
  state.procReadyAt[key] = at + 5;
  return true;
}

export function applyElementalistAura(
  context: ElementalistSchedulerContext,
  {
    at,
    aura,
    duration,
    skillName,
    sourceId,
  }: {
    at: number;
    aura: string;
    duration: number;
    skillName: string;
    sourceId: Skill["id"];
  },
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const adjustedDuration = hasTrait(context, "Smothering Auras")
    ? duration * 1.33
    : duration;
  const auraState: ElementalistAuraState = {
    type: aura,
    appliedAt: at,
    expiresAt: at + adjustedDuration,
    skillName,
  };
  state.activeAuras.push(auraState);
  context.emit({
    type: "elementalist.aura",
    at,
    source: skillName,
    sourceId,
    actorType: "effect",
    skillName,
    aura,
    duration: adjustedDuration,
  });
  if (hasTrait(context, "Zephyr's Boon")) {
    emitBuff(context, at, "Fury", 1, 5, skillName, sourceId);
    emitBuff(context, at, "Swiftness", 1, 5, skillName, sourceId);
  }
  if (hasTrait(context, "Elemental Shielding")) {
    emitBuff(context, at, "Protection", 1, 3, skillName, sourceId);
  }
  if (hasTrait(context, "Invigorating Torrents")) {
    emitBuff(context, at, "Vigor", 1, 5, skillName, sourceId);
    emitBuff(context, at, "Regeneration", 1, 5, skillName, sourceId);
  }
  if (hasTrait(context, "Elemental Bastion")) {
    emitBuff(context, at, "Alacrity", 1, 4, skillName, sourceId);
  }
  if (hasTrait(context, "Tempestuous Aria")) {
    emitBuff(context, at, "Tempestuous Aria", 1, 5, skillName, sourceId);
  }
  if (hasTrait(context, "Empowering Auras")) {
    emitBuff(context, at, "Empowering Auras", 1, 10, skillName, sourceId);
  }
}

export function triggerElementalistSunspot(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    !hasTrait(context, "Sunspot") ||
    !evokerTraitProcReady(context, state, "sunspot", at)
  ) {
    return;
  }
  context.emit({
    type: "damage",
    at,
    source: "Sunspot",
    sourceId,
    actorType: "effect",
    skillName: "Sunspot",
    coefficient: 0.6,
    skillWeapon: "Unequipped",
    noCrit: true,
  });
  applyElementalistAura(context, {
    at,
    aura: "Fire Aura",
    duration: 3,
    skillName: "Sunspot",
    sourceId,
  });
  if (hasTrait(context, "Burning Rage")) {
    emitCondition(context, at, "Burning", 2, 4, "Sunspot", sourceId);
  }
}

export function triggerElementalistFlameExpulsion(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    !hasTrait(context, "Pyromancer's Puissance") ||
    !evokerTraitProcReady(context, state, "flameExpulsion", at)
  ) {
    return;
  }
  const cappedMight = Math.min(10, context.buffStacks("might", at));
  context.emit({
    type: "damage",
    at,
    source: "Flame Expulsion",
    sourceId,
    actorType: "effect",
    skillName: "Flame Expulsion",
    coefficient: 1 + 0.1 * cappedMight,
    skillWeapon: "Unequipped",
  });
  emitCondition(
    context,
    at,
    "Burning",
    1,
    Math.min(7, 2 + 0.5 * cappedMight),
    "Flame Expulsion",
    sourceId,
  );
}

export function triggerElementalistElectricDischarge(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  if (!hasTrait(context, "Electric Discharge")) return;
  context.emit({
    type: "damage",
    at,
    source: "Electric Discharge",
    sourceId,
    actorType: "effect",
    skillName: "Electric Discharge",
    coefficient: 0.35,
    skillWeapon: "Unequipped",
  });
  emitCondition(
    context,
    at,
    "Vulnerability",
    1,
    8,
    "Electric Discharge",
    sourceId,
  );
}

export function triggerElementalistEarthenBlast(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    !hasTrait(context, "Earthen Blast") ||
    !evokerTraitProcReady(context, state, "earthenBlast", at)
  ) {
    return;
  }
  context.emit({
    type: "damage",
    at,
    source: "Earthen Blast",
    sourceId,
    actorType: "effect",
    skillName: "Earthen Blast",
    coefficient: 0.36,
    skillWeapon: "Unequipped",
    noCrit: true,
  });
}

function grantElementalistRockSolid(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    !hasTrait(context, "Rock Solid") ||
    !evokerTraitProcReady(context, state, "rockSolid", at)
  ) {
    return;
  }
  emitBuff(context, at, "Stability", 1, 3, "Rock Solid", sourceId);
}

function grantElementalAttunementBoon(
  context: ElementalistSchedulerContext,
  at: number,
  attunement: ElementalistAttunement,
  sourceId: Skill["id"],
): void {
  if (!hasTrait(context, "Elemental Attunement")) return;
  if (attunement === "Fire") {
    emitBuff(context, at, "Might", 1, 15, "Elemental Attunement", sourceId);
  } else if (attunement === "Water") {
    emitBuff(
      context,
      at,
      "Regeneration",
      1,
      5,
      "Elemental Attunement",
      sourceId,
    );
  } else if (attunement === "Air") {
    emitBuff(context, at, "Swiftness", 1, 8, "Elemental Attunement", sourceId);
  } else {
    emitBuff(context, at, "Protection", 1, 5, "Elemental Attunement", sourceId);
  }
}

function triggerBountifulPower(
  context: ElementalistSchedulerContext,
  at: number,
  stacks: number,
  sourceId: Skill["id"],
): void {
  if (!hasTrait(context, "Bountiful Power")) return;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  state.bountifulPowerProgress += stacks;
  while (state.bountifulPowerProgress >= 5) {
    state.bountifulPowerProgress -= 5;
    emitBuff(context, at, "Quickness", 1, 5, "Bountiful Power", sourceId);
    emitBuff(
      context,
      at,
      "Bountiful Power Active",
      1,
      7,
      "Bountiful Power",
      sourceId,
    );
  }
}

function onAttunementComplete(
  context: ElementalistLifecycleContext,
  skill: Skill,
  target: ElementalistAttunement,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  const previous = state.primaryAttunement;
  state.autoattackCarryover = progressedAutoattackCarryover(
    context,
    state,
    previous,
  );
  state.pendingAutoattackCarryover = state.autoattackCarryover
    ? null
    : inFlightAutoattackCarryover(context, previous);
  const specializationState = context.state.profession.specialization
    .state as SchedulerRecord;
  const weaveSelfActive =
    specialization(context) === "Weaver" &&
    Number(specializationState.weaveSelfUntil || 0) > at;
  if (specialization(context) === "Weaver") {
    state.secondaryAttunement =
      state.unravelUntil > at ? target : state.primaryAttunement;
    state.primaryAttunement = target;
    const recharge = alacrityAdjusted(
      context,
      weaveSelfActive
        ? 2
        : attunementRechargeSeconds(
            context,
            WEAVER_ATTUNEMENT_RECHARGE_SECONDS,
          ),
    );
    for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
      setElementalistAttunementReadyAt(context, attunement, at + recharge);
    }
  } else {
    state.primaryAttunement = target;
    state.secondaryAttunement = null;
    setElementalistAttunementReadyAt(
      context,
      previous,
      Math.max(
        state.attunementReadyAt[previous],
        at +
          alacrityAdjusted(
            context,
            attunementRechargeSeconds(context, ATTUNEMENT_RECHARGE_SECONDS),
          ),
      ),
    );
    for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
      if (attunement === target || attunement === previous) continue;
      setElementalistAttunementReadyAt(
        context,
        attunement,
        Math.max(
          state.attunementReadyAt[attunement],
          at +
            alacrityAdjusted(
              context,
              attunementRechargeSeconds(
                context,
                OFF_ATTUNEMENT_RECHARGE_SECONDS,
              ),
            ),
        ),
      );
    }
  }
  state.attunementEnteredAt = at;
  context.emit({
    type: "elementalist.attunement",
    at,
    source: skill.name,
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    from: previous,
    to: target,
    secondaryAttunement: state.secondaryAttunement,
  });
  if (weaveSelfActive) {
    const visited = new Set(
      Array.isArray(specializationState.weaveSelfVisited)
        ? specializationState.weaveSelfVisited.map(String)
        : [],
    );
    visited.add(target);
    specializationState.weaveSelfVisited = [...visited];
    const remaining = Math.max(
      0,
      Number(specializationState.weaveSelfUntil) - at,
    );
    if (target === "Fire") {
      emitBuff(
        context,
        at,
        "Weave Self Fire",
        1,
        remaining,
        skill.name,
        skill.id,
      );
    } else if (target === "Air") {
      emitBuff(
        context,
        at,
        "Weave Self Air",
        1,
        remaining,
        skill.name,
        skill.id,
      );
    }
    if (visited.size >= ELEMENTALIST_ATTUNEMENTS.length) {
      specializationState.weaveSelfUntil = 0;
      specializationState.weaveSelfVisited = [];
      specializationState.perfectWeaveUntil = at + 10;
      emitBuff(context, at, "Perfect Weave", 1, 10, skill.name, skill.id);
      emitBuff(context, at, "Weave Self Fire", 1, 10, skill.name, skill.id);
      emitBuff(context, at, "Weave Self Air", 1, 10, skill.name, skill.id);
    }
  }
  if (previous === "Fire" && target !== "Fire") {
    triggerElementalistFlameExpulsion(context, at, skill.id);
  }
  if (target === "Fire") triggerElementalistSunspot(context, at, skill.id);
  if (target === "Air") {
    triggerElementalistElectricDischarge(context, at, skill.id);
    if (previous !== "Air" && hasTrait(context, "Fresh Air")) {
      state.freshAirLastResetAt = at;
      emitBuff(context, at, "Fresh Air", 1, 5, skill.name, skill.id);
    }
    if (hasTrait(context, "One with Air")) {
      emitBuff(context, at, "Superspeed", 1, 3, skill.name, skill.id);
    }
    if (hasTrait(context, "Inscription")) {
      emitBuff(context, at, "Resistance", 1, 3, skill.name, skill.id);
    }
  }
  if (target === "Water" && hasTrait(context, "Latent Stamina")) {
    const readyAt = Number(state.procReadyAt.latentStamina || 0);
    if (readyAt <= at + context.epsilon) {
      state.procReadyAt.latentStamina = at + 10;
      emitBuff(context, at, "Vigor", 1, 3, "Latent Stamina", skill.id);
    }
  }
  if (target === "Earth") {
    triggerElementalistEarthenBlast(context, at, skill.id);
    grantElementalistRockSolid(context, at, skill.id);
  }
  if (hasTrait(context, "Arcane Prowess")) {
    emitBuff(context, at, "Might", 1, 8, "Arcane Prowess", skill.id);
  }
  grantElementalAttunementBoon(context, at, target, skill.id);
  if (specialization(context) === "Weaver") {
    const unravelActive = state.unravelUntil > at;
    if (
      hasTrait(context, "Weaver's Prowess") &&
      (unravelActive || target === previous)
    ) {
      emitBuff(context, at, "Resistance", 1, 3, "Weaver's Prowess", skill.id);
    }
    triggerBountifulPower(context, at, unravelActive ? 1 : 2, skill.id);
  } else {
    triggerBountifulPower(context, at, 1, skill.id);
  }
}

function applyFieldAndAura(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  if (skill.comboField && Number(skill.fieldDuration) > 0) {
    const bonus =
      hasTrait(context, "Persisting Flames") && skill.comboField === "Fire"
        ? 2
        : 0;
    const duration = Number(skill.fieldDuration) + bonus;
    state.activeComboFields.push({
      type: String(skill.comboField),
      startsAt: at,
      expiresAt: at + duration,
      skillName: skill.name,
    });
    context.emit({
      type: "elementalist.combo-field",
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      field: skill.comboField,
      duration,
    });
  }
  if (skill.aura) {
    const [element, rawDuration] = String(skill.aura).split("|");
    const duration = Number(rawDuration || 0);
    if (element && duration > 0) {
      applyElementalistAura(context, {
        at,
        aura: `${element} Aura`,
        duration,
        skillName: skill.name,
        sourceId: skill.id,
      });
    }
  }
}

function applyPistolState(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  if (skill.weapon !== "Pistol") return;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const dual = PISTOL_DUAL_ELEMENTS[skill.name];
  if (dual) {
    const active = dual.filter((element) => state.pistolBullets[element]);
    if (active.length) {
      for (const element of active) state.pistolBullets[element] = false;
    } else {
      state.pistolBullets[state.primaryAttunement] = true;
    }
    return;
  }
  const element = PISTOL_SKILL_ELEMENTS[skill.name];
  if (!element) return;
  if (state.pistolBullets[element] && !PISTOL_NO_CONSUME.has(skill.name)) {
    state.pistolBullets[element] = false;
    if (skill.name === "Searing Salvo") {
      applyElementalistAura(context, {
        at: context.effectiveEnd,
        aura: "Fire Aura",
        duration: 4,
        skillName: skill.name,
        sourceId: skill.id,
      });
    }
  } else if (!PISTOL_NO_GRANT.has(skill.name)) {
    state.pistolBullets[element] = true;
  }
}

function applyHammerState(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  if (skill.weapon !== "Hammer") return;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  const single = HAMMER_ORB_SKILLS[skill.name];
  const dual = HAMMER_DUAL_ORB_SKILLS[skill.name];
  if (single || dual) {
    for (const [element, expiresAt] of Object.entries(state.hammerOrbs)) {
      if (expiresAt != null && expiresAt >= at) {
        state.hammerOrbs[element as ElementalistAttunement] = at + 15;
      }
    }
    for (const element of single ? [single] : dual) {
      state.hammerOrbs[element] = at + 15;
    }
    return;
  }
  if (skill.name !== "Grand Finale") return;
  const active = ELEMENTALIST_ATTUNEMENTS.filter(
    (element) => Number(state.hammerOrbs[element] || 0) >= context.start,
  );
  const conditions: Readonly<
    Record<ElementalistAttunement, readonly [string, number, number]>
  > = {
    Fire: ["Burning", 2, 5],
    Water: ["Vulnerability", 6, 10],
    Air: ["Weakness", 1, 5],
    Earth: ["Bleeding", 4, 5],
  };
  for (let index = 1; index < active.length; index += 1) {
    context.emit({
      type: "damage",
      at: at + 0.68,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      coefficient: 1,
      skillWeapon: "Hammer",
      hitIndex: index + 1,
      totalHits: active.length,
    });
  }
  for (const element of active) {
    const [condition, stacks, duration] = conditions[element];
    emitCondition(
      context,
      at + 0.68,
      condition,
      stacks,
      duration,
      skill.name,
      skill.id,
    );
    state.hammerOrbs[element] = null;
  }
}

function triggerEvasiveArcana(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  if (!hasTrait(context, "Evasive Arcana")) return;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  const attunement = state.primaryAttunement;
  const key = `evasiveArcana${attunement}`;
  if (Number(state.procReadyAt[key] || 0) > at + context.epsilon) return;
  state.procReadyAt[key] = at + 10;
  const source =
    attunement === "Fire"
      ? "Flame Burst (trait)"
      : attunement === "Water"
        ? "Cleansing Wave (trait)"
        : attunement === "Air"
          ? "Blinding Flash (trait)"
          : "Shock Wave (trait)";
  if (attunement === "Fire") {
    context.emit({
      type: "damage",
      at,
      source,
      sourceId: skill.id,
      actorType: "effect",
      skillName: source,
      coefficient: 1,
      skillWeapon: "Unequipped",
    });
    emitCondition(context, at, "Burning", 3, 6, source, skill.id);
  } else if (attunement === "Air") {
    context.emit({
      type: "blind",
      at,
      source,
      sourceId: skill.id,
      actorType: "effect",
      skillName: source,
      controlKind: "blind",
    });
  } else if (attunement === "Earth") {
    context.emit({
      type: "damage",
      at,
      source,
      sourceId: skill.id,
      actorType: "effect",
      skillName: source,
      coefficient: 0.5,
      skillWeapon: "Unequipped",
      finisherType: "Blast",
      finisherValue: 1,
    });
    emitCondition(context, at, "Bleeding", 1, 20, source, skill.id);
    emitCondition(context, at, "Cripple", 1, 2, source, skill.id);
  }
  context.emit({
    type: "elementalist.evasive-arcana",
    at,
    source,
    sourceId: skill.id,
    actorType: "effect",
    skillName: source,
    attunement,
  });
}

function applyGenericPostCast(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  if (
    hasTrait(context, "Pyromancer's Puissance") &&
    state.primaryAttunement === "Fire"
  ) {
    emitBuff(context, at, "Might", 1, 15, skill.name, skill.id);
  }
  if (hasTrait(context, "Tempestuous Aria") && skill.skillFamily === "Shout") {
    emitBuff(context, at, "Might", 2, 10, skill.name, skill.id);
  }
  if (skill.type === "Heal") {
    if (hasTrait(context, "Gale Song")) {
      emitBuff(context, at, "Protection", 1, 3, "Gale Song", skill.id);
    }
    if (
      hasTrait(context, "Earth's Embrace") &&
      Number(state.procReadyAt.earthsEmbrace || 0) <= at + context.epsilon
    ) {
      state.procReadyAt.earthsEmbrace = at + 15;
      emitBuff(context, at, "Resistance", 1, 4, "Earth's Embrace", skill.id);
    }
    if (
      hasTrait(context, "Soothing Ice") &&
      Number(state.procReadyAt.soothingIce || 0) <= at + context.epsilon
    ) {
      state.procReadyAt.soothingIce = at + 15;
      applyElementalistAura(context, {
        at,
        aura: "Frost Aura",
        duration: 4,
        skillName: "Soothing Ice",
        sourceId: skill.id,
      });
      emitBuff(context, at, "Regeneration", 1, 4, "Soothing Ice", skill.id);
    }
  }
  if (
    hasTrait(context, "Altruistic Aspect") &&
    skill.skillFamily === "Meditation"
  ) {
    const boon =
      skill.name === "Fox's Fury"
        ? (["Might", 3, 10] as const)
        : skill.name === "Hare's Agility"
          ? (["Fury", 1, 5] as const)
          : skill.name === "Toad's Fortitude"
            ? (["Stability", 1, 5] as const)
            : skill.name === "Elemental Procession"
              ? (["Resistance", 1, 5] as const)
              : null;
    if (boon)
      emitBuff(context, at, boon[0], boon[1], boon[2], skill.name, skill.id);
  }
  if (hasTrait(context, "Written in Stone") && skill.skillFamily === "Signet") {
    const aura =
      skill.name === "Signet of Restoration"
        ? (["Frost Aura", 4] as const)
        : skill.name === "Signet of Fire"
          ? (["Fire Aura", 4] as const)
          : skill.name === "Signet of Earth"
            ? (["Magnetic Aura", 3] as const)
            : null;
    if (aura) {
      applyElementalistAura(context, {
        at,
        aura: aura[0],
        duration: aura[1],
        skillName: "Written in Stone",
        sourceId: skill.id,
      });
    }
  }
  if (hasTrait(context, "Inscription") && skill.skillFamily === "Glyph") {
    const boon =
      state.primaryAttunement === "Fire"
        ? (["Might", 1, 10] as const)
        : state.primaryAttunement === "Water"
          ? (["Regeneration", 1, 10] as const)
          : state.primaryAttunement === "Air"
            ? (["Swiftness", 1, 10] as const)
            : (["Protection", 1, 3] as const);
    emitBuff(context, at, boon[0], boon[1], boon[2], skill.name, skill.id);
  }
  if (
    hasTrait(context, "Bolstered Elements") &&
    skill.skillFamily === "Stance"
  ) {
    emitBuff(context, at, "Protection", 1, 3, skill.name, skill.id);
  }
  if (
    hasTrait(context, "Swift Revenge") &&
    String(skill.attunement || "").includes("+")
  ) {
    for (const element of new Set(String(skill.attunement).split("+"))) {
      if (element === "Fire") {
        emitBuff(context, at, "Might", 3, 5, skill.name, skill.id);
      } else if (element === "Air") {
        emitBuff(context, at, "Swiftness", 1, 5, skill.name, skill.id);
      } else if (element === "Earth") {
        state.endurance = Math.min(100, state.endurance + 25);
      }
    }
  }
  if (hasTrait(context, "Arcane Lightning") && skill.skillFamily === "Arcane") {
    emitBuff(context, at, "Arcane Lightning", 1, 15, skill.name, skill.id);
    if (skill.name === "Arcane Brilliance") {
      emitBuff(context, at, "Protection", 1, 3.5, skill.name, skill.id);
    } else if (skill.name === "Arcane Wave") {
      emitCondition(context, at, "Immobilized", 1, 2, skill.name, skill.id);
    } else if (skill.name === "Arcane Blast") {
      context.emit({
        type: "blind",
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: "effect",
        skillName: skill.name,
        controlKind: "blind",
      });
    } else if (skill.name === "Arcane Echo") {
      emitBuff(context, at, "Quickness", 1, 4, skill.name, skill.id);
    }
  }
  if (
    hasTrait(context, "Superior Elements") &&
    String(skill.attunement || "").includes("+") &&
    Number(state.procReadyAt.superiorElements || 0) <= at + context.epsilon
  ) {
    state.procReadyAt.superiorElements = at + 4;
    emitCondition(context, at, "Weakness", 1, 5, skill.name, skill.id);
  }
}

export function elementalistOnCastComplete(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  const target = targetAttunement(skill);
  if (target) {
    onAttunementComplete(context, skill, target);
    return;
  }
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  updateAutoattackChainState(context, skill, state);
  shareAttunementVariantRecharge(context, skill);
  if (skill.name === "Dodge") {
    updateEndurance(
      state,
      context.effectiveEnd,
      Boolean(context.config.boons?.vigor),
    );
    state.endurance = Math.max(0, state.endurance - DODGE_ENDURANCE_COST);
    triggerEvasiveArcana(context, skill);
  }
  if (skill.name === "Arcane Echo") {
    state.arcaneEchoUntil = context.effectiveEnd + 10;
  } else if (
    state.arcaneEchoUntil >= context.effectiveEnd &&
    skill.type === "Weapon" &&
    Number(skill.cooldown || 0) > 0
  ) {
    state.arcaneEchoUntil = 0;
    context.state.cooldowns.set(skill.id, context.effectiveEnd + 1);
    const arcaneEcho = context.catalog.skillsByName.get("Arcane Echo");
    if (arcaneEcho) {
      const currentReadyAt = Number(
        context.state.cooldowns.get(arcaneEcho.id) || context.effectiveEnd,
      );
      context.state.cooldowns.set(
        arcaneEcho.id,
        currentReadyAt + context.rechargeDuration,
      );
    }
  }
  if (skill.name === "Fulgor") {
    for (let index = 0; index < 6; index += 1) {
      context.emit({
        type: "damage",
        at: context.start + 0.32 + index,
        source: skill.name,
        sourceId: skill.id,
        actorType: "effect",
        skillName: skill.name,
        skillId: skill.id,
        coefficient: 0,
        flatStrikeBase: 200,
        flatStrikePowerCoeff: 0.4,
        noCrit: true,
      });
    }
  }
  applyFieldAndAura(context, skill);
  applyPistolState(context, skill);
  applyHammerState(context, skill);
  applyGenericPostCast(context, skill);
}

function activeField(
  state: ElementalistCoreState,
  at: number,
): { type: string } | null {
  return (
    state.activeComboFields.find(
      (field) => field.startsAt <= at && field.expiresAt > at,
    ) || null
  );
}

function comboKey(event: SimulationEvent): string {
  return `${String(event.activationId || event.skillId)}:${event.at}:${String(event.finisherType)}`;
}

function applyCombo(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
  fieldType: string,
  finisherType: string,
): void {
  const at = event.at;
  const sourceId = event.skillId ?? event.sourceId;
  const source = `Combo (${fieldType}/${finisherType})`;
  if (fieldType === "Fire") {
    if (finisherType === "Blast") {
      emitBuff(context, at, "Might", 3, 20, source, sourceId);
    } else if (finisherType === "Leap") {
      applyElementalistAura(context, {
        at,
        aura: "Fire Aura",
        duration: 5,
        skillName: source,
        sourceId,
      });
    } else {
      emitCondition(context, at, "Burning", 1, 1, source, sourceId);
    }
  } else if (fieldType === "Ice") {
    if (finisherType === "Blast" || finisherType === "Leap") {
      applyElementalistAura(context, {
        at,
        aura: "Frost Aura",
        duration: finisherType === "Leap" ? 5 : 3,
        skillName: source,
        sourceId,
      });
    } else {
      emitCondition(context, at, "Chilled", 1, 1, source, sourceId);
    }
  } else if (fieldType === "Lightning") {
    if (finisherType === "Blast") {
      emitBuff(context, at, "Swiftness", 1, 10, source, sourceId);
    } else if (finisherType !== "Leap") {
      emitCondition(context, at, "Vulnerability", 2, 5, source, sourceId);
    }
  } else if (fieldType === "Water" && finisherType === "Projectile") {
    emitBuff(context, at, "Regeneration", 1, 2, source, sourceId);
  } else if (fieldType === "Poison") {
    if (finisherType === "Blast" || finisherType === "Leap") {
      emitCondition(
        context,
        at,
        "Weakness",
        1,
        finisherType === "Leap" ? 8 : 3,
        source,
        sourceId,
      );
    } else {
      emitCondition(context, at, "Poisoned", 1, 2, source, sourceId);
    }
  } else if (fieldType === "Dark") {
    if (finisherType === "Blast" || finisherType === "Leap") {
      applyElementalistAura(context, {
        at,
        aura: "Dark Aura",
        duration: finisherType === "Leap" ? 5 : 3,
        skillName: source,
        sourceId,
      });
    } else {
      context.emitDerived(event, {
        type: "damage",
        at,
        source,
        sourceId,
        actorType: "effect",
        skillName:
          finisherType === "Whirl"
            ? "Leeching Bolt"
            : "Life Stealing Projectile",
        coefficient: 0,
        flatStrikeBase: finisherType === "Whirl" ? 170 : 202,
        flatStrikePowerCoeff: 0.03,
        noCrit: true,
      });
    }
  }
}

function observeComboFinisher(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  const finisherType = String(event.finisherType || "");
  if (!finisherType) return;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const key = comboKey(event);
  const resolved = (state as SchedulerRecord).resolvedComboKeys as
    | Set<string>
    | undefined;
  const keys = resolved || new Set<string>();
  (state as SchedulerRecord).resolvedComboKeys = keys;
  if (keys.has(key)) return;
  keys.add(key);
  const field = activeField(state, event.at);
  if (!field) return;
  context.emitDerived(event, {
    type: "elementalist.combo",
    at: event.at,
    source: String(event.skillName || "Elementalist Combo"),
    sourceId: event.skillId ?? event.sourceId,
    actorType: "effect",
    skillName: String(event.skillName || "Elementalist Combo"),
    attunement: state.primaryAttunement,
    field: field.type,
    finisherType,
  });
  const value = Math.max(0, Number(event.finisherValue || 1));
  if (finisherType === "Projectile") {
    state.comboProgress.Projectile += value;
    while (state.comboProgress.Projectile >= 1) {
      state.comboProgress.Projectile -= 1;
      applyCombo(context, event, field.type, finisherType);
    }
    return;
  }
  const repeats = finisherType === "Whirl" ? Math.max(1, Math.floor(value)) : 1;
  for (let index = 0; index < repeats; index += 1) {
    applyCombo(context, event, field.type, finisherType);
  }
}

function observeFreshAir(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  if (
    event.type !== "damage" ||
    event.actorType !== "player" ||
    event.canCrit === false ||
    event.noCrit ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context, "Fresh Air")
  ) {
    return;
  }
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (state.attunementReadyAt.Air <= event.at + context.epsilon) return;
  state.freshAirProgress += eventCriticalChance(context);
  if (state.freshAirProgress + context.epsilon < 1) return;
  state.freshAirProgress -= 1;
  setElementalistAttunementReadyAt(
    context as unknown as SchedulerRecord,
    "Air",
    event.at,
  );
  context.state.cooldowns.delete(ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Air);
  context.state.cooldowns.delete(ELEMENTALIST_OVERLOAD_SKILL_IDS.Air);
  context.emitDerived(event, {
    type: "elementalist.fresh-air",
    at: event.at,
    source: "Fresh Air",
    sourceId: "Fresh Air",
    actorType: "effect",
    skillName: "Fresh Air",
  });
}

function observeBurningPrecision(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  if (
    event.type !== "damage" ||
    event.actorType !== "player" ||
    event.canCrit === false ||
    event.noCrit ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context, "Burning Precision")
  ) {
    return;
  }
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const chance = eventCriticalChance(context);
  state.burningPrecisionProgress += chance * 0.33;
  if (
    state.burningPrecisionProgress + context.epsilon < 1 ||
    Number(state.procReadyAt.burningPrecision || 0) > event.at + context.epsilon
  ) {
    return;
  }
  state.burningPrecisionProgress -= 1;
  state.procReadyAt.burningPrecision = event.at + 5;
  emitCondition(
    context,
    event.at,
    "Burning",
    1,
    3,
    "Burning Precision",
    "Burning Precision",
  );
}

function eventCriticalChance(context: ElementalistSchedulerContext): number {
  const stats = (context.config.stats || {}) as SchedulerRecord;
  return Math.min(
    1,
    criticalChance(Number(stats.precision || 0)) +
      (context.config.boons?.fury ? 0.25 : 0) +
      Number(stats.criticalChanceBonus || 0) / 100,
  );
}

function observeCriticalTraits(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  if (
    event.type !== "damage" ||
    event.actorType !== "player" ||
    event.canCrit === false ||
    event.noCrit ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const chance = eventCriticalChance(context);
  if (hasTrait(context, "Raging Storm")) {
    state.criticalProcProgress.ragingStorm =
      Number(state.criticalProcProgress.ragingStorm || 0) + chance;
    if (
      state.criticalProcProgress.ragingStorm + context.epsilon >= 1 &&
      Number(state.procReadyAt.ragingStorm || 0) <= event.at + context.epsilon
    ) {
      state.criticalProcProgress.ragingStorm -= 1;
      state.procReadyAt.ragingStorm = event.at + 8;
      emitBuff(
        context,
        event.at,
        "Fury",
        1,
        4,
        "Raging Storm",
        event.skillId ?? event.sourceId,
      );
    }
  }
  if (hasTrait(context, "Arcane Precision")) {
    state.criticalProcProgress.arcanePrecision =
      Number(state.criticalProcProgress.arcanePrecision || 0) + chance * 0.33;
    if (
      state.criticalProcProgress.arcanePrecision + context.epsilon >= 1 &&
      Number(state.procReadyAt.arcanePrecision || 0) <=
        event.at + context.epsilon
    ) {
      state.criticalProcProgress.arcanePrecision -= 1;
      state.procReadyAt.arcanePrecision = event.at + 3;
      const attunement = state.primaryAttunement;
      if (attunement === "Fire") {
        emitCondition(
          context,
          event.at,
          "Burning",
          1,
          1.5,
          "Arcane Precision",
          event.skillId ?? event.sourceId,
        );
      } else if (attunement === "Water") {
        emitCondition(
          context,
          event.at,
          "Vulnerability",
          1,
          10,
          "Arcane Precision",
          event.skillId ?? event.sourceId,
        );
      } else if (attunement === "Air") {
        emitCondition(
          context,
          event.at,
          "Weakness",
          1,
          3,
          "Arcane Precision",
          event.skillId ?? event.sourceId,
        );
      } else {
        emitCondition(
          context,
          event.at,
          "Bleeding",
          1,
          5,
          "Arcane Precision",
          event.skillId ?? event.sourceId,
        );
      }
    }
  }
  if (hasTrait(context, "Renewing Stamina")) {
    state.criticalProcProgress.renewingStamina =
      Number(state.criticalProcProgress.renewingStamina || 0) + chance;
    if (
      state.criticalProcProgress.renewingStamina + context.epsilon >= 1 &&
      Number(state.procReadyAt.renewingStamina || 0) <=
        event.at + context.epsilon
    ) {
      state.criticalProcProgress.renewingStamina -= 1;
      state.procReadyAt.renewingStamina = event.at + 10;
      emitBuff(
        context,
        event.at,
        "Vigor",
        1,
        5,
        "Renewing Stamina",
        event.skillId ?? event.sourceId,
      );
    }
  }
}

function observeLightningRod(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  if (event.type !== "control" || event.actorType !== "player") return;
  const sourceId = event.skillId ?? event.sourceId;
  if (hasTrait(context, "Lightning Rod")) {
    context.emitDerived(event, {
      type: "damage",
      at: event.at,
      source: "Lightning Rod",
      sourceId,
      actorType: "effect",
      skillName: "Lightning Rod",
      coefficient: 1.5,
      skillWeapon: "Unequipped",
    });
    emitCondition(
      context,
      event.at,
      "Weakness",
      1,
      4,
      "Lightning Rod",
      sourceId,
    );
  }
  if (hasTrait(context, "Elemental Pursuit")) {
    emitBuff(
      context,
      event.at,
      "Swiftness",
      1,
      3,
      "Elemental Pursuit",
      sourceId,
    );
  }
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    !hasTrait(context, "Elemental Lockdown") ||
    Number(state.procReadyAt.elementalLockdown || 0) >
      event.at + context.epsilon
  ) {
    return;
  }
  state.procReadyAt.elementalLockdown = event.at + 1;
  if (state.primaryAttunement === "Fire") {
    emitBuff(context, event.at, "Might", 5, 5, "Elemental Lockdown", sourceId);
  } else if (state.primaryAttunement === "Water") {
    emitBuff(
      context,
      event.at,
      "Regeneration",
      1,
      10,
      "Elemental Lockdown",
      sourceId,
    );
  } else if (state.primaryAttunement === "Air") {
    emitBuff(context, event.at, "Fury", 1, 5, "Elemental Lockdown", sourceId);
  } else {
    emitBuff(
      context,
      event.at,
      "Protection",
      1,
      4,
      "Elemental Lockdown",
      sourceId,
    );
  }
}

function observePersistingFlames(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  if (
    event.type !== "condition" ||
    event.condition !== "Burning" ||
    !hasTrait(context, "Persisting Flames")
  ) {
    return;
  }
  emitBuff(
    context,
    event.at + context.epsilon,
    "Persisting Flames",
    1,
    15,
    String(event.skillName || "Persisting Flames"),
    event.skillId ?? event.sourceId,
  );
}

export function observeElementalistEvent(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  observeFreshAir(context, event);
  observeBurningPrecision(context, event);
  observeCriticalTraits(context, event);
  observeLightningRod(context, event);
  observePersistingFlames(context, event);
  observeComboFinisher(context, event);
}

export function advanceElementalistState(
  context: ElementalistSchedulerContext,
  at: number,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  updateEndurance(state, at, Boolean(context.config.boons?.vigor));
  state.activeComboFields = state.activeComboFields.filter(
    (field) => field.expiresAt > at,
  );
  state.activeAuras = state.activeAuras.filter((aura) => aura.expiresAt > at);
}

export function modifyElementalistRechargeDuration(
  context: ElementalistSchedulerContext & { skill?: Skill },
  duration: number,
): number {
  const skill = context.skill;
  if (!skill) return duration;
  if (skill.type !== "Weapon") {
    return (skill.overload || skill.skillFamily === "Jade Sphere") &&
      hasTrait(context, "Elemental Enchantment")
      ? duration * 0.85
      : duration;
  }
  let adjustedDuration =
    skill.name === "Ride the Lightning" ? duration * 0.5 : duration;
  const attunement = String(skill.attunement || "");
  if (
    (attunement === "Fire" && hasTrait(context, "Pyromancer's Training")) ||
    (attunement === "Air" && hasTrait(context, "Aeromancer's Training")) ||
    (attunement === "Earth" && hasTrait(context, "Geomancer's Training")) ||
    (attunement === "Water" && hasTrait(context, "Aquamancer's Training")) ||
    (String(skill.slot) === "Weapon_3" &&
      attunement.includes("+") &&
      hasTrait(context, "Flow State"))
  ) {
    adjustedDuration *= 0.8;
  }
  return adjustedDuration;
}

export const elementalistCoreCastRules = Object.freeze({
  availability: {
    id: "elementalist.core-availability",
    order: 10,
    handler: elementalistCoreAvailability,
  },
  modifyRechargeDuration: modifyElementalistRechargeDuration,
});

export const elementalistCoreSchedulerHooks = Object.freeze({
  advance: {
    id: "elementalist.core-state",
    order: 10,
    handler: advanceElementalistState,
  },
  onEventScheduled: {
    id: "elementalist.combos-and-fresh-air",
    order: 10,
    handler: observeElementalistEvent,
  },
  onCastComplete: {
    id: "elementalist.core-cast-complete",
    order: 10,
    handler: elementalistOnCastComplete,
  },
  onCooldownReset: {
    id: "elementalist.attunement-cooldown-reset",
    order: 10,
    handler: resetElementalistAttunementCooldowns,
  },
});
