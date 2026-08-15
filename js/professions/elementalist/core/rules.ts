import { criticalChance } from "../../../platform/gw2/damage.js";
import { produceGw2OwnedComboEvents } from "../../../platform/gw2/scheduler/combo-materializer.js";
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
  SimulationEventInput,
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
import {
  beginElementalistGlyphCast,
  completeElementalistFlameBarrageCommand,
  completeElementalistGlyphCast,
  elementalistElementalAvailability,
  elementalistElementalTaskHandlers,
  observeElementalistElementalEvent,
} from "./elementals.js";

const ATTUNEMENT_RECHARGE_SECONDS = 10;
const OFF_ATTUNEMENT_RECHARGE_SECONDS = 1.5;
const WEAVER_ATTUNEMENT_RECHARGE_SECONDS = 4;
const DODGE_ENDURANCE_COST = 50;
const ENDURANCE_PER_SECOND = 5;
const AUTOATTACK_CHAIN_PRESERVING_SKILLS = new Set([
  "Ride the Lightning",
  "Relentless Fire",
  "Weave Self",
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
const PERSISTING_FLAMES_FIELD_SKILLS = new Set([
  "Lava Font",
  "Pyroclastic Blast",
  "Burning Retreat",
  "Burning Speed",
  "Flamewall",
  "Wildfire",
  "Flame Uprising",
  "Ring of Fire",
]);
const CONJURE_SKILLS: Readonly<Record<string, string>> = Object.freeze({
  "Conjure Frost Bow": "Frost Bow",
  "Conjure Lightning Hammer": "Lightning Hammer",
  "Conjure Fiery Greatsword": "Fiery Greatsword",
});
const CONJURED_WEAPONS = new Set(Object.values(CONJURE_SKILLS));
const AURA_TRANSMUTE_SKILLS: Readonly<Record<string, string>> = Object.freeze({
  "Transmute Frost": "Frost Aura",
  "Transmute Lightning": "Shocking Aura",
  "Transmute Earth": "Magnetic Aura",
  "Transmute Fire": "Fire Aura",
});
const ETCHING_CHAINS = Object.freeze([
  {
    etching: "Etching: Volcano",
    lesser: "Lesser Volcano",
    full: "Volcano",
  },
  {
    etching: "Etching: Jökulhlaup",
    lesser: "Lesser Jökulhlaup",
    full: "Jökulhlaup",
  },
  {
    etching: "Etching: Derecho",
    lesser: "Lesser Derecho",
    full: "Derecho",
  },
  {
    etching: "Etching: Haboob",
    lesser: "Lesser Haboob",
    full: "Haboob",
  },
] as const);
const FULL_ETCHING_CHARGE_SKILLS = new Set([
  "Overload Fire",
  "Overload Air",
  "Overload Earth",
]);
const SPEAR_FOLLOWUP_ARM_SKILLS = new Set([
  "Seethe",
  "Ripple",
  "Energize",
  "Harden",
]);
const BOON_KINDS = new Set([
  "aegis",
  "alacrity",
  "fury",
  "might",
  "protection",
  "quickness",
  "regeneration",
  "resistance",
  "resolution",
  "stability",
  "superspeed",
  "swiftness",
  "vigor",
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

interface EvokerAttunementRuntimeState extends SchedulerRecord {
  pendingOffAttunementRemainingByCommand: Record<
    number,
    Partial<Record<ElementalistAttunement, number>>
  >;
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

function projectedFreshAirReadyAt(
  context: ElementalistCastContext,
  upTo: number,
): number | null {
  if (!hasTrait(context, "Fresh Air")) return null;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (state.primaryAttunement === "Air") return null;
  let progress = state.freshAirProgress;
  const candidates = [...state.freshAirCandidates].sort(
    (left, right) => left.at - right.at,
  );
  for (const candidate of candidates) {
    if (candidate.at > upTo + context.epsilon) break;
    progress += candidate.criticalChance;
    if (progress + context.epsilon >= 1) return candidate.at;
  }
  return null;
}

function prepareElementalistHitboxEvent(
  context: ElementalistSchedulerContext,
  event: SimulationEventInput,
): SimulationEventInput {
  const skill =
    context.catalog.skillsById.get(event.skillId ?? event.sourceId) ||
    context.catalog.skillsByName.get(String(event.skillName || event.name));
  const preparedEvent =
    skill?.overload &&
    String(event.skillName || event.name || "") === skill.name
      ? { ...event, skillWeapon: "Profession mechanic" }
      : event;
  const professionAssumptions = (context.config.professionAssumptions ||
    {}) as SchedulerRecord;
  const hitboxSize = String(
    professionAssumptions.hitboxSize || context.config.hitboxSize || "small",
  );
  if (hitboxSize !== "small") return preparedEvent;
  const hitIndex = Number(preparedEvent.elementalistHitboxIndex || 0);
  const smallHitboxCap = Number(preparedEvent.elementalistSmallHitboxCap || 0);
  const excluded =
    preparedEvent.elementalistLargeHitboxOnly === true ||
    (smallHitboxCap > 0 && hitIndex > smallHitboxCap);
  if (!excluded) return preparedEvent;
  return {
    ...preparedEvent,
    type: "marker",
    name: `${String(preparedEvent.skillName || preparedEvent.name || "Elementalist effect")} misses small hitbox`,
    cancelled: true,
    detail: "excluded by Elementalist target-hitbox rules",
    elementalistHitboxExcluded: true,
  };
}

function scheduleGrandFinaleProfile(
  context: ElementalistLifecycleContext,
  skill: Skill,
): boolean {
  if (skill.name !== "Grand Finale") return false;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const active = ELEMENTALIST_ATTUNEMENTS.filter((element) => {
    const expiresAt = state.hammerOrbs[element];
    return expiresAt != null && expiresAt >= context.start;
  });
  const conditions: Readonly<
    Record<ElementalistAttunement, readonly [string, number, number]>
  > = {
    Fire: ["Burning", 2, 5],
    Water: ["Vulnerability", 6, 10],
    Air: ["Weakness", 1, 5],
    Earth: ["Bleeding", 4, 5],
  };
  const at = context.effectiveEnd + 0.68;
  for (let index = 0; index < active.length; index += 1) {
    const element = active[index];
    context.emit({
      type: "damage",
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      coefficient: 1.4,
      skillWeapon: "Hammer",
      comboFinishers: [
        {
          ownerId: "elementalist",
          finisherType: "Projectile",
          ambiguousFieldSelection: "oldest",
        },
      ],
      hitIndex: index + 1,
      totalHits: active.length,
    });
    const [condition, stacks, duration] = conditions[element];
    emitCondition(
      context,
      at,
      condition,
      stacks,
      duration,
      skill.name,
      skill.id,
    );
  }
  return true;
}

function scheduleElementalistSkill(
  context: ElementalistLifecycleContext,
  skill: Skill,
): boolean {
  return scheduleGrandFinaleProfile(context, skill);
}

function skillWeapon(skill: Skill): string {
  return String(skill.weapon || skill.skillWeapon || "");
}

function etchingChain(name: string) {
  return ETCHING_CHAINS.find(
    (chain) =>
      name === chain.etching || name === chain.lesser || name === chain.full,
  );
}

function activeAura(
  state: ElementalistCoreState,
  aura: string,
  at: number,
): ElementalistAuraState | null {
  return (
    state.activeAuras.find(
      (candidate) => candidate.type === aura && candidate.expiresAt > at,
    ) || null
  );
}

function combatStarted(
  context: ElementalistSchedulerContext,
  at: number,
): boolean {
  return (
    !context.hasExplicitCombatStart ||
    (context.combatStartTime != null && at >= context.combatStartTime)
  );
}

function activeHammerOrbElements(
  state: ElementalistCoreState,
  at: number,
): ElementalistAttunement[] {
  return ELEMENTALIST_ATTUNEMENTS.filter((element) => {
    const expiresAt = state.hammerOrbs[element];
    return expiresAt != null && expiresAt >= at;
  });
}

function hammerOrbMatchesAttunement(
  context: ElementalistCastContext,
  state: ElementalistCoreState,
  element: ElementalistAttunement,
): boolean {
  if (specialization(context) !== "Weaver") {
    return element === state.primaryAttunement;
  }
  const grantedBy = state.hammerOrbGrantedBy[element];
  const grantingSkill = grantedBy
    ? context.catalog.skillsByName.get(grantedBy)
    : null;
  const required = String(grantingSkill?.attunement || element).split("+");
  const secondary = state.secondaryAttunement || state.primaryAttunement;
  return (
    required.includes(state.primaryAttunement) && required.includes(secondary)
  );
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

  if (state.unravelUntil > context.start) {
    return required.length === 1 && required[0] === state.primaryAttunement
      ? ready()
      : unavailable(
          skill,
          "elementalist.unravel-attunement",
          `requires ${state.primaryAttunement} while Unravel is active.`,
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
  const elementalAvailability = elementalistElementalAvailability(
    context,
    skill,
  );
  if (elementalAvailability) return elementalAvailability;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    skill.name === "Elemental Explosion" &&
    !ELEMENTALIST_ATTUNEMENTS.every((element) => state.pistolBullets[element])
  ) {
    return unavailable(
      skill,
      "elementalist.pistol-bullets",
      "requires all four elemental bullets.",
    );
  }
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
    const naturalReadyAt = Number(state.attunementReadyAt[target] || 0);
    if (specialization(context) === "Evoker") {
      const evokerState = context.state.profession.specialization
        .state as EvokerAttunementRuntimeState;
      if (!evokerState.pendingOffAttunementRemainingByCommand) {
        evokerState.pendingOffAttunementRemainingByCommand = {};
      }
      if (
        !evokerState.pendingOffAttunementRemainingByCommand[
          context.commandIndex
        ]
      ) {
        evokerState.pendingOffAttunementRemainingByCommand[
          context.commandIndex
        ] = Object.fromEntries(
          ELEMENTALIST_ATTUNEMENTS.map((attunement) => [
            attunement,
            Math.max(
              0,
              Number(state.attunementReadyAt[attunement] || 0) - context.start,
            ),
          ]),
        );
      }
    }
    const freshAirReadyAt =
      target === "Air"
        ? projectedFreshAirReadyAt(context, naturalReadyAt)
        : null;
    const readyAt =
      freshAirReadyAt == null
        ? naturalReadyAt
        : Math.min(naturalReadyAt, freshAirReadyAt);
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

  if (skill.name === "__drop_bundle") {
    return state.conjureEquipped
      ? ready()
      : unavailable(
          skill,
          "elementalist.no-bundle",
          "no conjured weapon is equipped.",
        );
  }
  if (skill.name.startsWith("__pickup_")) {
    const weapon = skill.name.slice("__pickup_".length);
    const expiresAt = Number(state.conjurePickups[weapon] || 0);
    return expiresAt >= context.start
      ? ready()
      : unavailable(
          skill,
          "elementalist.conjure-pickup",
          `the ${weapon} pickup is unavailable or expired.`,
        );
  }

  if (["Heal", "Utility", "Elite"].includes(String(skill.type))) {
    const selected = selectedSkillNames(context);
    const selectedChainSkill =
      (skill.name === "Tailored Victory" && selected.has("Weave Self")) ||
      (skill.name === "Flame Barrage" && selected.has("Glyph of Elementals"));
    if (!isSelectedSlotSkill(skill, selected) && !selectedChainSkill) {
      return unavailable(
        skill,
        "elementalist.not-equipped",
        "the skill is not equipped.",
      );
    }
  }

  const aura = AURA_TRANSMUTE_SKILLS[skill.name];
  if (aura && !activeAura(state, aura, context.start)) {
    return unavailable(
      skill,
      "elementalist.aura-transmute",
      `requires an active ${aura}.`,
    );
  }

  if (
    skill.name === "Hurl" &&
    state.rockBarrierExpiresAt <= context.start + context.epsilon
  ) {
    return unavailable(
      skill,
      "elementalist.rock-barrier",
      "requires an active Rock Barrier.",
    );
  }
  if (
    skill.name === "Rock Barrier" &&
    state.rockBarrierExpiresAt > context.start + context.epsilon
  ) {
    return unavailable(
      skill,
      "elementalist.rock-barrier-active",
      "Hurl or wait for the current barrier to expire.",
      state.rockBarrierExpiresAt,
    );
  }

  const chain = etchingChain(skill.name);
  if (chain && skill.name !== chain.etching) {
    const progress = state.etchings[chain.etching];
    const requiredStage = skill.name === chain.lesser ? "lesser" : "full";
    if (progress?.stage !== requiredStage) {
      return unavailable(
        skill,
        "elementalist.spear-etching",
        requiredStage === "lesser"
          ? `cast ${chain.etching} first.`
          : `cast three other skills after ${chain.etching} first.`,
      );
    }
  }

  const hammerElements = HAMMER_ORB_SKILLS[skill.name]
    ? [HAMMER_ORB_SKILLS[skill.name]]
    : HAMMER_DUAL_ORB_SKILLS[skill.name];
  if (hammerElements) {
    const retryAt = state.hammerOrbLastCastAt + 0.48;
    if (retryAt > context.start + context.epsilon) {
      return unavailable(
        skill,
        "elementalist.hammer-orb-lockout",
        `the shared orb lockout ends at ${retryAt.toFixed(3)}.`,
        retryAt,
      );
    }
    if (
      hammerElements.some((element) => {
        const expiresAt = state.hammerOrbs[element];
        return expiresAt != null && expiresAt >= context.start;
      })
    ) {
      return unavailable(
        skill,
        "elementalist.hammer-orb-active",
        "Grand Finale must consume the active orb before it can be created again.",
      );
    }
  }

  if (skill.name === "Grand Finale") {
    const compatible = activeHammerOrbElements(state, context.start).some(
      (element) => hammerOrbMatchesAttunement(context, state, element),
    );
    if (!compatible) {
      return unavailable(
        skill,
        "elementalist.hammer-orbs",
        "requires an active orb compatible with the current attunement.",
      );
    }
  }

  if (skill.type === "Weapon") {
    const weapon = skillWeapon(skill);
    if (CONJURED_WEAPONS.has(weapon)) {
      if (state.conjureEquipped !== weapon) {
        return unavailable(
          skill,
          "elementalist.conjure-required",
          `requires the ${weapon} bundle.`,
        );
      }
    } else if (state.conjureEquipped) {
      return unavailable(
        skill,
        "elementalist.bundle-equipped",
        `drop ${state.conjureEquipped} before using normal weapon skills.`,
      );
    }
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

export function emitElementalistBuff(
  context: ElementalistSchedulerContext,
  at: number,
  kind: string,
  stacks: number,
  duration: number,
  source: string,
  sourceId: Skill["id"],
  priority = 0,
): void {
  const normalizedKind = kind.toLowerCase();
  const adjustedDuration = elementalistBuffDuration(
    context,
    normalizedKind,
    duration,
    source,
    sourceId,
  );
  context.emit({
    type: "buff",
    at,
    source,
    sourceId,
    actorType: "player",
    kind: normalizedKind,
    stacks,
    duration: adjustedDuration,
    skillName: source,
    priority,
  });
}

export function elementalistBuffDuration(
  context: ElementalistSchedulerContext,
  kind: string,
  duration: number,
  source: string,
  sourceId: Skill["id"],
): number {
  const normalizedKind = kind.toLowerCase();
  if (!BOON_KINDS.has(normalizedKind)) return duration;
  const sourceSkill =
    context.catalog.skillsById.get(Number(sourceId)) ||
    context.catalog.skillsByName.get(source) ||
    context.catalog.skills[0];
  if (!sourceSkill) return duration;
  return (
    context.schedulerPolicy.effectDuration?.(
      context,
      sourceSkill,
      { type: "boon", boon: normalizedKind, duration },
      duration,
    ) ?? duration
  );
}

const emitBuff = emitElementalistBuff;

function activeBuffEvents(
  context: ElementalistSchedulerContext,
  kind: string,
  at: number,
): SimulationEvent[] {
  const normalized = kind.toLowerCase();
  return context.events.filter(
    (event) =>
      event.type === "buff" &&
      String(event.kind || "").toLowerCase() === normalized &&
      event.at <= at &&
      event.at + Number(event.duration || 0) > at,
  );
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

export function emitElementalistProc(
  context: ElementalistSchedulerContext,
  {
    at,
    name,
    procType,
    sourceId,
    sourceSkill = "",
    detail = "",
    icon = "",
  }: {
    at: number;
    name: string;
    procType: "trait" | "skill";
    sourceId: Skill["id"];
    sourceSkill?: string;
    detail?: string;
    icon?: string;
  },
): void {
  context.emit({
    type: "proc",
    at,
    source: name,
    sourceId,
    actorType: "effect",
    name,
    skillName: name,
    procType,
    sourceSkill,
    detail,
    icon,
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
    priority = 0,
  }: {
    at: number;
    aura: string;
    duration: number;
    skillName: string;
    sourceId: Skill["id"];
    priority?: number;
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
    ...(priority ? { priority } : {}),
  });
  if (!combatStarted(context, at)) return;
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
  if (
    String(context.config.specialization || "Core") === "Catalyst" &&
    hasTrait(context, "Elemental Epitome")
  ) {
    emitBuff(context, at, "Elemental Empowerment", 1, 15, skillName, sourceId);
  }
}

export function triggerElementalistSunspot(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    !combatStarted(context, at) ||
    !hasTrait(context, "Sunspot") ||
    !evokerTraitProcReady(context, state, "sunspot", at)
  ) {
    return;
  }
  const applySunspotAura = () =>
    applyElementalistAura(context, {
      at,
      aura: "Fire Aura",
      duration: 3,
      skillName: "Sunspot",
      sourceId,
    });
  const catalyst = context.config.specialization === "Catalyst";
  if (catalyst) applySunspotAura();
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
  if (!catalyst) applySunspotAura();
  if (hasTrait(context, "Burning Rage")) {
    emitCondition(context, at, "Burning", 2, 4, "Sunspot", sourceId);
  }
  emitElementalistProc(context, {
    at,
    name: "Sunspot",
    procType: "trait",
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name,
  });
}

export function triggerElementalistFlameExpulsion(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    !combatStarted(context, at) ||
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
  emitElementalistProc(context, {
    at,
    name: "Flame Expulsion",
    procType: "trait",
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name,
    icon: "https://render.guildwars2.com/file/998095CB1FD2CF0164B8A36BABFDB911DF08DB02/1012313.png",
  });
}

export function triggerElementalistElectricDischarge(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  if (!combatStarted(context, at) || !hasTrait(context, "Electric Discharge"))
    return;
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
  emitElementalistProc(context, {
    at,
    name: "Electric Discharge",
    procType: "trait",
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name,
  });
}

export function triggerElementalistEarthenBlast(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    !combatStarted(context, at) ||
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
  emitElementalistProc(context, {
    at,
    name: "Earthen Blast",
    procType: "trait",
    sourceId,
    sourceSkill: context.catalog.skillsById.get(sourceId)?.name,
  });
}

export function grantElementalistRockSolid(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill["id"],
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    !combatStarted(context, at) ||
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
    const isEvoker = specialization(context) === "Evoker";
    const evokerState = isEvoker
      ? (specializationState as EvokerAttunementRuntimeState)
      : null;
    const preservedOffCooldowns =
      evokerState?.pendingOffAttunementRemainingByCommand?.[
        context.commandIndex
      ];
    if (evokerState) {
      delete evokerState.pendingOffAttunementRemainingByCommand?.[
        context.commandIndex
      ];
    }
    const evokerElement = String(specializationState.element || "");
    const previousRechargeSeconds =
      isEvoker && previous === evokerElement
        ? OFF_ATTUNEMENT_RECHARGE_SECONDS
        : ATTUNEMENT_RECHARGE_SECONDS;
    setElementalistAttunementReadyAt(
      context,
      previous,
      Math.max(
        state.attunementReadyAt[previous],
        at +
          alacrityAdjusted(
            context,
            attunementRechargeSeconds(context, previousRechargeSeconds),
          ),
      ),
    );
    for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
      if (attunement === target || attunement === previous) continue;
      const existingReadyAt = state.attunementReadyAt[attunement];
      const defaultReadyAt =
        at +
        alacrityAdjusted(
          context,
          attunementRechargeSeconds(context, OFF_ATTUNEMENT_RECHARGE_SECONDS),
        );
      const preserveShortEvokerRecharge =
        isEvoker &&
        Number.isFinite(preservedOffCooldowns?.[attunement]) &&
        Number(preservedOffCooldowns?.[attunement]) > 0 &&
        Number(preservedOffCooldowns?.[attunement]) < defaultReadyAt - at;
      let nextReadyAt = preserveShortEvokerRecharge
        ? at + Number(preservedOffCooldowns?.[attunement])
        : Math.max(existingReadyAt, defaultReadyAt);
      if (attunement === "Air" && hasTrait(context, "Fresh Air")) {
        const freshAirReadyAt = projectedFreshAirReadyAt(
          context as unknown as ElementalistCastContext,
          nextReadyAt,
        );
        if (freshAirReadyAt != null) {
          nextReadyAt = Math.min(nextReadyAt, freshAirReadyAt);
        }
      }
      setElementalistAttunementReadyAt(context, attunement, nextReadyAt);
    }
  }
  state.attunementEnteredAt = at;
  context.emit({
    type: "elementalist.attunement",
    at,
    priority: -20,
    source: skill.name,
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    from: previous,
    to: target,
    secondaryAttunement: state.secondaryAttunement,
  });
  context.emit({
    type: "sigil_swap",
    at,
    source: skill.name,
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
  });
  // The reference applies Weaver's fully-attuned Elements of Rage window
  // during setup as well as combat, so a precombat double-attunement can
  // carry the trait into the opening hit.
  if (
    specialization(context) === "Weaver" &&
    (target === previous || state.unravelUntil > at) &&
    hasTrait(context, "Elements of Rage")
  ) {
    emitBuff(context, at, "Elements of Rage", 1, 8, skill.name, skill.id);
  }
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
  if (!combatStarted(context, at)) return;
  if (previous === "Fire" && target !== "Fire") {
    triggerElementalistFlameExpulsion(context, at, skill.id);
  }
  if (target === "Fire") triggerElementalistSunspot(context, at, skill.id);
  if (target === "Air") {
    triggerElementalistElectricDischarge(context, at, skill.id);
    if (previous !== "Air" && hasTrait(context, "Fresh Air")) {
      state.freshAirLastResetAt = at;
      emitBuff(context, at, "Fresh Air", 1, 5, skill.name, skill.id, -10);
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
  if (specialization(context) !== "Weaver" || target !== previous) {
    grantElementalAttunementBoon(context, at, target, skill.id);
  }
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

function applySkillAura(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  if (!skill.aura) return;
  const [element, rawDuration] = String(skill.aura).split("|");
  const duration = Number(rawDuration || 0);
  if (!element || !(duration > 0)) return;
  applyElementalistAura(context, {
    at: context.effectiveEnd,
    aura: `${element} Aura`,
    duration,
    skillName: skill.name,
    sourceId: skill.id,
  });
}

function applyPistolState(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  if (skillWeapon(skill) !== "Pistol") return;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  const dual = PISTOL_DUAL_ELEMENTS[skill.name];
  if (dual) {
    const active = dual.filter((element) => state.pistolBullets[element]);
    if (active.length) {
      for (const element of active) {
        state.pistolBullets[element] = false;
        if (skill.name === "Frostfire Flurry") {
          if (element === "Fire") {
            applyElementalistAura(context, {
              at,
              aura: "Fire Aura",
              duration: 3,
              skillName: skill.name,
              sourceId: skill.id,
            });
          } else if (element === "Water") {
            emitCondition(
              context,
              at,
              "Vulnerability",
              4,
              8,
              skill.name,
              skill.id,
            );
          }
        } else if (skill.name === "Purblinding Plasma" && element === "Fire") {
          emitCondition(context, at, "Burning", 3, 4, skill.name, skill.id);
        } else if (skill.name === "Molten Meteor" && element === "Earth") {
          emitCondition(context, at, "Bleeding", 3, 8, skill.name, skill.id);
        } else if (skill.name === "Flowing Finesse") {
          if (element === "Water") {
            applyElementalistAura(context, {
              at,
              aura: "Frost Aura",
              duration: 3,
              skillName: skill.name,
              sourceId: skill.id,
            });
          } else if (element === "Air") {
            emitBuff(context, at, "Superspeed", 1, 4, skill.name, skill.id);
          }
        } else if (skill.name === "Enervating Earth") {
          if (element === "Air") {
            context.emit({
              type: "control",
              at,
              source: skill.name,
              sourceId: skill.id,
              actorType: "player",
              skillName: skill.name,
              skillId: skill.id,
              controlKind: "crowd-control",
            });
          } else if (element === "Earth") {
            emitCondition(context, at, "Bleeding", 4, 8, skill.name, skill.id);
          }
        }
      }
    } else {
      state.pistolBullets[state.primaryAttunement] = true;
    }
    return;
  }
  const element = PISTOL_SKILL_ELEMENTS[skill.name];
  if (!element) return;
  if (state.pistolBullets[element] && !PISTOL_NO_CONSUME.has(skill.name)) {
    state.pistolBullets[element] = false;
    if (skill.name === "Raging Ricochet") {
      emitBuff(context, at, "Might", 1, 10, skill.name, skill.id);
    } else if (skill.name === "Searing Salvo") {
      applyElementalistAura(context, {
        at,
        aura: "Fire Aura",
        duration: 4,
        skillName: skill.name,
        sourceId: skill.id,
      });
    } else if (skill.name === "Frozen Fusillade") {
      context.emit({
        type: "damage",
        at: at + 4,
        source: skill.name,
        sourceId: skill.id,
        actorType: "player",
        skillName: skill.name,
        skillId: skill.id,
        coefficient: 0.75,
        skillWeapon: "Pistol",
      });
      emitCondition(context, at + 4, "Bleeding", 5, 8, skill.name, skill.id);
    } else if (skill.name === "Dazing Discharge") {
      state.dazingDischargeUntil = at + 5;
    } else if (skill.name === "Shattering Stone") {
      state.shatteringStoneHitsRemaining = 3;
      state.shatteringStoneUntil = at + 10;
    } else if (skill.name === "Boulder Blast") {
      context.emit({
        type: "damage",
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: "effect",
        skillName: skill.name,
        skillId: skill.id,
        coefficient: 0,
        noCrit: true,
        comboFinishers: [
          {
            ownerId: "elementalist",
            finisherType: "Projectile",
            ambiguousFieldSelection: "oldest",
          },
        ],
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
  if (skillWeapon(skill) !== "Hammer") return;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  const single = HAMMER_ORB_SKILLS[skill.name];
  const dual = HAMMER_DUAL_ORB_SKILLS[skill.name];
  if (single || dual) {
    const previouslyActive = new Set(activeHammerOrbElements(state, at));
    for (const [element, expiresAt] of Object.entries(state.hammerOrbs)) {
      if (expiresAt != null && expiresAt >= at) {
        state.hammerOrbs[element as ElementalistAttunement] = at + 15;
        for (const event of activeBuffEvents(
          context,
          `hammer ${element} orb`,
          at,
        )) {
          context.replaceEvent(event, { duration: at + 15 - event.at });
        }
      }
    }
    for (const element of single ? [single] : dual) {
      state.hammerOrbs[element] = at + 15;
      state.hammerOrbGrantedBy[element] = skill.name;
      state.hammerOrbActivationIds[element] = context.reservationId;
      state.hammerOrbBuffUntil[element] = at + 15;
      if (!previouslyActive.has(element)) {
        emitBuff(
          context,
          at,
          `Hammer ${element} Orb`,
          1,
          15,
          skill.name,
          skill.id,
        );
      }
    }
    state.hammerOrbLastCastAt = at;
    return;
  }
  if (skill.name !== "Grand Finale") return;
  const active = ELEMENTALIST_ATTUNEMENTS.filter((element) => {
    const expiresAt = state.hammerOrbs[element];
    return expiresAt != null && expiresAt >= context.start;
  });
  for (const element of active) {
    state.hammerOrbBuffUntil[element] = at + 1;
    for (const event of activeBuffEvents(
      context,
      `hammer ${element} orb`,
      at,
    )) {
      context.replaceEvent(event, { duration: at + 1 - event.at });
    }
    state.hammerOrbs[element] = null;
    state.hammerOrbGrantedBy[element] = null;
    state.hammerOrbActivationIds[element] = null;
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
      comboFinishers: [
        {
          ownerId: "elementalist",
          finisherType: "Blast",
          ambiguousFieldSelection: "oldest",
        },
      ],
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
  emitElementalistProc(context as never, {
    at,
    name: source,
    procType: "trait",
    sourceId: skill.id,
    sourceSkill: skill.name,
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
    state.primaryAttunement === "Fire" &&
    combatStarted(context, at)
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

export function elementalistOnCastStart(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  // Aura-bearing skills grant their aura before same-time strike/condition
  // packets, so aura-triggered modifiers can affect the skill that granted it.
  applySkillAura(context, skill);
  beginElementalistGlyphCast(context, skill);
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const chain = etchingChain(skill.name);
  if (chain && skill.name === chain.etching && skillWeapon(skill) === "Spear") {
    state.etchings[chain.etching] = { stage: "lesser", otherCasts: 0 };
  }

  if (skill.name === "Grand Finale") {
    const activations = new Set(
      Object.values(state.hammerOrbActivationIds).filter(
        (value): value is string => Boolean(value),
      ),
    );
    for (const event of [...context.events]) {
      if (
        activations.has(String(event.activationId || "")) &&
        event.at >= context.start &&
        (event.type === "damage" || event.type === "condition")
      ) {
        context.replaceEvent(event, {
          type: "marker",
          cancelled: true,
          detail: "cancelled by Grand Finale",
        });
      }
    }
  }

  if (
    skillWeapon(skill) === "Spear" &&
    String(skill.slot || "") !== "Weapon_1"
  ) {
    const followup = {
      damage: state.spearNextDamageBonus,
      critical: state.spearNextGuaranteedCritical,
      control: state.spearNextControlHit,
    };
    if (followup.damage || followup.critical || followup.control) {
      state.spearFollowups[context.reservationId] = followup;
      state.spearNextDamageBonus = false;
      state.spearNextGuaranteedCritical = false;
      state.spearNextControlHit = false;
    }
  }
}

function extendPersistingFlamesPackets(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  if (
    !hasTrait(context, "Persisting Flames") ||
    !PERSISTING_FLAMES_FIELD_SKILLS.has(skill.name)
  ) {
    return;
  }
  const fieldPackets = context.events
    .filter(
      (event) =>
        event.activationId === context.reservationId &&
        event.type === "damage" &&
        event.damageKind === "field-tick",
    )
    .sort((left, right) => left.at - right.at);
  if (fieldPackets.length < 2) return;
  const template = fieldPackets.at(-1);
  const previous = fieldPackets.at(-2);
  if (!template || !previous) return;
  const interval = template.at - previous.at;
  if (!(interval > context.epsilon)) return;
  const attachedConditions = context.events.filter(
    (event) =>
      event.activationId === context.reservationId &&
      event.type === "condition" &&
      Math.abs(event.at - template.at) <= context.epsilon,
  );
  for (let index = 1; index <= 2; index += 1) {
    const at = template.at + interval * index;
    context.emit({
      ...template,
      at,
      elementalistLargeHitboxOnly: false,
    });
    for (const condition of attachedConditions) {
      context.emit({
        ...condition,
        at,
        elementalistLargeHitboxOnly: false,
      });
    }
  }
}

function extendPersistingFlamesField(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  if (
    event.type !== "action" ||
    !hasTrait(context, "Persisting Flames") ||
    !PERSISTING_FLAMES_FIELD_SKILLS.has(String(event.skillName || event.name))
  ) {
    return;
  }
  const field = context.events.find(
    (candidate) =>
      candidate.type === "combo_field" &&
      candidate.activationId === event.activationId &&
      candidate.fieldType === "Fire",
  );
  if (!field) return;
  context.replaceEvent(field, {
    expiresAt: Number(field.expiresAt) + 2,
  });
}

export function elementalistAfterCast(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  extendPersistingFlamesPackets(context, skill);
  const activationEvents = context.events
    .filter(
      (event) =>
        event.activationId === context.reservationId &&
        event.type === "damage" &&
        Number(event.coefficient || 0) > 0,
    )
    .sort((left, right) => left.at - right.at);

  if (skill.name === "Frigid Flurry" && state.pistolBullets.Water === true) {
    for (const [index, event] of activationEvents.entries()) {
      const replacement = context.replaceEvent(event, {
        comboFinishers: [
          {
            ownerId: "elementalist",
            attemptGroup: `runtime:${index + 1}`,
            finisherType: "Projectile",
            chance: 0.2,
            ambiguousFieldSelection: "oldest",
          },
        ],
      });
      produceGw2OwnedComboEvents(
        context as unknown as SchedulerContext,
        replacement,
      );
    }
  }

  const followup = state.spearFollowups[context.reservationId];
  if (!followup) return;
  for (const event of activationEvents) {
    context.replaceEvent(event, {
      ...(followup.damage
        ? { coefficient: Number(event.coefficient || 0) * 1.2 }
        : {}),
      ...(followup.critical ? { forceCrit: true } : {}),
    });
  }
  if (followup.control && activationEvents[0]) {
    const first = activationEvents[0];
    context.emit({
      type: "control",
      at: first.at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      skillId: skill.id,
      controlKind: "crowd-control",
    });
  }
  delete state.spearFollowups[context.reservationId];
}

function applyConjureState(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  const conjuredWeapon = CONJURE_SKILLS[skill.name];
  let swapped = false;
  if (conjuredWeapon) {
    state.conjureEquipped = conjuredWeapon;
    state.conjurePickups[conjuredWeapon] = at + 35;
    swapped = true;
    if (hasTrait(context, "Conjurer")) {
      applyElementalistAura(context, {
        at,
        aura: "Fire Aura",
        duration: 4,
        skillName: "Conjurer",
        sourceId: skill.id,
      });
    }
  } else if (skill.name === "__drop_bundle") {
    swapped = state.conjureEquipped != null;
    state.conjureEquipped = null;
  } else if (skill.name.startsWith("__pickup_")) {
    const weapon = skill.name.slice("__pickup_".length);
    if (Number(state.conjurePickups[weapon] || 0) >= context.start) {
      state.conjureEquipped = weapon;
      delete state.conjurePickups[weapon];
      swapped = true;
    }
  }
  if (swapped) {
    context.emit({
      type: "sigil_swap",
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
    });
  }
}

function applySpecialSkillProgression(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;

  if (skill.name === "Rock Barrier") {
    state.rockBarrierExpiresAt = at + 30;
  } else if (skill.name === "Hurl") {
    state.rockBarrierExpiresAt = 0;
    const root = context.catalog.skillsByName.get("Rock Barrier");
    if (root) {
      context.state.cooldowns.set(
        root.id,
        at +
          context.rechargeDurationFor(root, at, { rockBarrierRelease: true }),
      );
    }
  }

  const aura = AURA_TRANSMUTE_SKILLS[skill.name];
  if (aura) {
    state.activeAuras = state.activeAuras.filter(
      (candidate) => candidate.type !== aura || candidate.expiresAt <= at,
    );
  }

  if (skill.name === "Elemental Explosion") {
    const auraByAttunement: Readonly<
      Record<ElementalistAttunement, readonly [string, number]>
    > = {
      Fire: ["Fire Aura", 4],
      Water: ["Frost Aura", 4],
      Air: ["Shocking Aura", 3],
      Earth: ["Magnetic Aura", 3],
    };
    const [auraName, duration] = auraByAttunement[state.primaryAttunement];
    applyElementalistAura(context, {
      at,
      aura: auraName,
      duration,
      skillName: skill.name,
      sourceId: skill.id,
    });
    for (const element of ELEMENTALIST_ATTUNEMENTS) {
      state.pistolBullets[element] = false;
    }
  }

  const chain = etchingChain(skill.name);
  if (chain && skill.name !== chain.etching && skillWeapon(skill) === "Spear") {
    state.etchings[chain.etching] = null;
  } else if (!chain || skill.name === chain.etching) {
    for (const candidate of ETCHING_CHAINS) {
      const progress = state.etchings[candidate.etching];
      if (!progress || progress.stage !== "lesser") continue;
      if (skill.name === candidate.etching) continue;
      const otherCasts =
        progress.otherCasts +
        (FULL_ETCHING_CHARGE_SKILLS.has(skill.name) ? 3 : 1);
      state.etchings[candidate.etching] = {
        stage: otherCasts >= 3 ? "full" : "lesser",
        otherCasts,
      };
    }
  }

  if (skill.name === "Seethe") state.spearNextDamageBonus = true;
  if (skill.name === "Ripple") state.spearNextRechargeReduction = true;
  if (skill.name === "Energize") state.spearNextGuaranteedCritical = true;
  if (skill.name === "Harden") state.spearNextControlHit = true;

  if (
    specialization(context) === "Weaver" &&
    skillWeapon(skill) === "Spear" &&
    String(skill.slot || "") === "Weapon_3" &&
    String(skill.attunement || "").includes("+") &&
    state.primaryAttunement !== state.secondaryAttunement
  ) {
    setElementalistAttunementReadyAt(context, state.primaryAttunement, at);
  }

  if (Number(skill.enduranceCost || 0) > 0) {
    updateEndurance(state, at, Boolean(context.config.boons?.vigor));
    state.endurance = Math.min(
      100,
      state.endurance + Number(skill.enduranceCost),
    );
  }

  if (
    skill.name === "Signet of Fire" &&
    !hasTrait(context, "Written in Stone")
  ) {
    state.signetOfFireDisabledUntil = Number(context.rechargeReadyAt || at);
    context.emit({
      type: "elementalist.signet-fire",
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      disabledUntil: state.signetOfFireDisabledUntil,
    });
  }
}

export function elementalistOnCastComplete(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  completeElementalistGlyphCast(context, skill);
  completeElementalistFlameBarrageCommand(context, skill);
  const target = targetAttunement(skill);
  if (target) {
    onAttunementComplete(context, skill, target);
    // Elementalist spear etchings count attunement swaps among the three
    // completed casts required to upgrade their release skill.
    applySpecialSkillProgression(context, skill);
    return;
  }
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  applyConjureState(context, skill);
  applySpecialSkillProgression(context, skill);
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
  applyPistolState(context, skill);
  applyHammerState(context, skill);
  applyGenericPostCast(context, skill);
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
  state.freshAirCandidates.push({
    at: event.at,
    criticalChance: eventCriticalChance(context),
    sourceId: event.skillId ?? event.sourceId,
    sourceSkill: String(event.skillName || event.source || ""),
  });
}

function processFreshAirCandidates(
  context: ElementalistSchedulerContext,
  through: number,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (!state.freshAirCandidates.length) return;
  const pending = [];
  const candidates = [...state.freshAirCandidates].sort(
    (left, right) => left.at - right.at,
  );
  for (const candidate of candidates) {
    if (candidate.at > through + context.epsilon) {
      pending.push(candidate);
      continue;
    }
    if (state.primaryAttunement === "Air") continue;
    state.freshAirProgress += candidate.criticalChance;
    if (state.freshAirProgress + context.epsilon < 1) continue;
    state.freshAirProgress -= 1;
    if (state.attunementReadyAt.Air > candidate.at + context.epsilon) {
      setElementalistAttunementReadyAt(
        context as unknown as SchedulerRecord,
        "Air",
        candidate.at,
      );
      context.state.cooldowns.delete(ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Air);
      context.state.cooldowns.delete(ELEMENTALIST_OVERLOAD_SKILL_IDS.Air);
    }
    context.emit({
      type: "elementalist.fresh-air",
      at: candidate.at,
      source: "Fresh Air",
      sourceId: "Fresh Air",
      actorType: "effect",
      skillName: "Fresh Air",
      sourceSkill: candidate.sourceSkill,
      triggeringSkillId: candidate.sourceId,
    });
  }
  state.freshAirCandidates = pending;
}

function eventCriticalChance(context: ElementalistSchedulerContext): number {
  const stats = (context.config.stats || {}) as SchedulerRecord;
  return Math.min(
    1,
    criticalChance(Number(stats.precision || 0)) +
      (context.config.boons?.fury ? 0.25 : 0) +
      Number(stats.criticalChanceBonus || 0) / 100 +
      (hasTrait(context, "Zephyr's Speed") ? 0.05 : 0),
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
      emitElementalistProc(context, {
        at: event.at,
        name: "Arcane Precision",
        procType: "trait",
        sourceId: event.skillId ?? event.sourceId,
        sourceSkill: String(event.skillName || event.source || ""),
      });
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
    emitElementalistProc(context, {
      at: event.at,
      name: "Lightning Rod",
      procType: "trait",
      sourceId,
      sourceSkill: String(event.skillName || event.source || ""),
    });
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

export function observeElementalistEvent(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  observeElementalistElementalEvent(context, event);
  extendPersistingFlamesField(context, event);
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (event.type === "combat_start") {
    state.catalystBaseEmpowermentActive = true;
  }
  if (
    event.type === "damage" &&
    event.actorType !== "summon" &&
    Number(event.coefficient || 0) > 0 &&
    state.shatteringStoneHitsRemaining > 0 &&
    event.at <= state.shatteringStoneUntil + context.epsilon
  ) {
    state.shatteringStoneHitsRemaining -= 1;
    if (state.shatteringStoneHitsRemaining === 0) {
      state.shatteringStoneUntil = 0;
    }
    emitCondition(
      context,
      event.at + context.epsilon,
      "Bleeding",
      1,
      5,
      "Shattering Stone",
      event.skillId ?? event.sourceId,
    );
  }
  observeFreshAir(context, event);
  observeCriticalTraits(context, event);
  observeLightningRod(context, event);
}

export function advanceElementalistState(
  context: ElementalistSchedulerContext,
  at: number,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  processFreshAirCandidates(context, at);
  updateEndurance(state, at, Boolean(context.config.boons?.vigor));
  state.activeAuras = state.activeAuras.filter((aura) => aura.expiresAt > at);
  for (const element of ELEMENTALIST_ATTUNEMENTS) {
    if (Number(state.hammerOrbs[element] || 0) < at) {
      state.hammerOrbs[element] = null;
      state.hammerOrbGrantedBy[element] = null;
      state.hammerOrbActivationIds[element] = null;
    }
  }
  for (const [weapon, expiresAt] of Object.entries(state.conjurePickups)) {
    if (expiresAt < at) delete state.conjurePickups[weapon];
  }
  if (state.shatteringStoneUntil < at) {
    state.shatteringStoneUntil = 0;
    state.shatteringStoneHitsRemaining = 0;
  }
  if (state.dazingDischargeUntil < at) state.dazingDischargeUntil = 0;
  if (state.rockBarrierExpiresAt > 0 && state.rockBarrierExpiresAt <= at) {
    const expiresAt = state.rockBarrierExpiresAt;
    state.rockBarrierExpiresAt = 0;
    const root = context.catalog.skillsByName.get("Rock Barrier");
    if (root) {
      context.state.cooldowns.set(
        root.id,
        expiresAt +
          context.rechargeDurationFor(root, expiresAt, {
            rockBarrierRelease: true,
          }),
      );
      delete state.autoattackChains[Number(root.id)];
    }
  }
}

export function modifyElementalistRechargeDuration(
  context: ElementalistSchedulerContext & { skill?: Skill },
  duration: number,
): number {
  const skill = context.skill;
  if (!skill) return duration;
  if (skill.name === "Glyph of Elementals") return 0;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = Number(
    (context as unknown as SchedulerRecord).start ?? context.state.time ?? 0,
  );
  if (
    skill.name === "Rock Barrier" &&
    !(context as unknown as SchedulerRecord).rockBarrierRelease
  ) {
    return 0;
  }
  if (skill.type !== "Weapon") {
    return (skill.overload || skill.skillFamily === "Jade Sphere") &&
      hasTrait(context, "Elemental Enchantment")
      ? duration * 0.85
      : duration;
  }
  let adjustedDuration = duration;
  let additiveReduction = 0;
  if (
    state.spearNextRechargeReduction &&
    skillWeapon(skill) === "Spear" &&
    String(skill.slot || "") !== "Weapon_1"
  ) {
    additiveReduction += 0.33;
    state.spearNextRechargeReduction = false;
  }
  if (
    state.dazingDischargeUntil > at &&
    skillWeapon(skill) === "Pistol" &&
    String(skill.slot || "") !== "Weapon_1"
  ) {
    additiveReduction += 0.33;
    state.dazingDischargeUntil = 0;
  }
  adjustedDuration *= Math.max(0, 1 - additiveReduction);
  if (skill.name === "Purblinding Plasma" && state.pistolBullets.Air) {
    adjustedDuration *= 2 / 3;
  }
  if (skill.name === "Ride the Lightning") adjustedDuration *= 0.5;
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
  taskHandlers: elementalistElementalTaskHandlers,
  prepareEvent: {
    id: "elementalist.hitbox",
    order: 10,
    handler: prepareElementalistHitboxEvent,
  },
  initialize: {
    id: "elementalist.core-initialize",
    order: 10,
    handler(context: ElementalistSchedulerContext) {
      elementalistCoreState(
        context as unknown as SchedulerRecord,
      ).catalystBaseEmpowermentActive = !context.hasExplicitCombatStart;
    },
  },
  onCastStart: {
    id: "elementalist.core-cast-start",
    order: 10,
    handler: elementalistOnCastStart,
  },
  scheduleSkill: {
    id: "elementalist.special-skill-profile",
    order: 10,
    handler: scheduleElementalistSkill,
  },
  afterCast: {
    id: "elementalist.core-after-cast",
    order: 10,
    handler: elementalistAfterCast,
  },
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
