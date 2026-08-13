import { flattenProfessionState } from "../../../platform/engine/profession.js";
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from "../data/ids.js";
import type {
  SchedulerConfig,
  SchedulerRecord,
} from "../../../platform/engine/types.js";

export const ELEMENTALIST_ATTUNEMENTS = Object.freeze([
  "Fire",
  "Water",
  "Air",
  "Earth",
] as const);

export type ElementalistAttunement = (typeof ELEMENTALIST_ATTUNEMENTS)[number];

export interface ElementalistFieldState {
  type: string;
  startsAt: number;
  expiresAt: number;
  skillName: string;
}

export interface ElementalistAuraState {
  type: string;
  appliedAt: number;
  expiresAt: number;
  skillName: string;
}

export interface ElementalistSummonedElementalState extends SchedulerRecord {
  element: ElementalistAttunement | null;
  summonGeneration: number;
  actionGeneration: number;
  activeUntil: number;
  busyUntil: number;
  nextActionAt: number;
  flameBurstReadyAt: number;
  currentActivationId: string | null;
  started: boolean;
}

export interface ElementalistCoreState extends SchedulerRecord {
  primaryAttunement: ElementalistAttunement;
  secondaryAttunement: ElementalistAttunement | null;
  attunementEnteredAt: number;
  attunementReadyAt: Record<ElementalistAttunement, number>;
  autoattackChains: Record<number, number>;
  autoattackCarryover: {
    root: number;
    attunement: ElementalistAttunement;
  } | null;
  pendingAutoattackCarryover: {
    root: number;
    attunement: ElementalistAttunement;
  } | null;
  freshAirProgress: number;
  freshAirLastResetAt: number;
  freshAirCandidates: Array<{
    at: number;
    criticalChance: number;
    sourceId: string | number;
    sourceSkill: string;
  }>;
  burningPrecisionProgress: number;
  bountifulPowerProgress: number;
  criticalProcProgress: Record<string, number>;
  endurance: number;
  enduranceUpdatedAt: number;
  activeComboFields: ElementalistFieldState[];
  activeAuras: ElementalistAuraState[];
  comboProgress: Record<string, number>;
  pistolBullets: Record<ElementalistAttunement, boolean>;
  dazingDischargeUntil: number;
  shatteringStoneHitsRemaining: number;
  shatteringStoneUntil: number;
  hammerOrbs: Record<ElementalistAttunement, number | null>;
  hammerOrbGrantedBy: Record<ElementalistAttunement, string | null>;
  hammerOrbActivationIds: Record<ElementalistAttunement, string | null>;
  hammerOrbBuffUntil: Record<ElementalistAttunement, number>;
  hammerOrbLastCastAt: number;
  etchings: Record<
    string,
    { stage: "lesser" | "full"; otherCasts: number } | null
  >;
  rockBarrierExpiresAt: number;
  spearNextDamageBonus: boolean;
  spearNextRechargeReduction: boolean;
  spearNextGuaranteedCritical: boolean;
  spearNextControlHit: boolean;
  spearFollowups: Record<
    string,
    { damage: boolean; critical: boolean; control: boolean }
  >;
  conjureEquipped: string | null;
  conjurePickups: Record<string, number>;
  signetOfFireDisabledUntil: number;
  catalystBaseEmpowermentActive: boolean;
  availableFlips: Record<string, number>;
  summonedElemental: ElementalistSummonedElementalState;
  procReadyAt: Record<string, number>;
  unravelUntil: number;
  arcaneEchoUntil: number;
}

export function isElementalistAttunement(
  value: unknown,
): value is ElementalistAttunement {
  return ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement);
}

export function createElementalistCoreState(
  config: Readonly<SchedulerConfig> = {},
): ElementalistCoreState {
  const specialization = String(config.specialization || "Core");
  const specializedElement =
    specialization === "Evoker" &&
    Array.isArray(config.selectedTraits) &&
    config.selectedTraits.includes("Specialized Elements") &&
    isElementalistAttunement(config.evokerElement)
      ? config.evokerElement
      : null;
  const primary =
    specializedElement ||
    (isElementalistAttunement(config.startAttunement)
      ? config.startAttunement
      : "Fire");
  const secondary =
    specialization === "Weaver"
      ? isElementalistAttunement(config.secondaryAttunement)
        ? config.secondaryAttunement
        : primary
      : null;
  const configuredBullets =
    config.pistolBullets && typeof config.pistolBullets === "object"
      ? (config.pistolBullets as Partial<
          Record<ElementalistAttunement, boolean>
        >)
      : {};
  return {
    primaryAttunement: primary,
    secondaryAttunement: secondary,
    attunementEnteredAt: 0,
    attunementReadyAt: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
    autoattackChains: {},
    autoattackCarryover: null,
    pendingAutoattackCarryover: null,
    freshAirProgress: 0,
    freshAirLastResetAt: Number.NEGATIVE_INFINITY,
    freshAirCandidates: [],
    burningPrecisionProgress: 0,
    bountifulPowerProgress: 0,
    criticalProcProgress: {},
    endurance: 100,
    enduranceUpdatedAt: 0,
    activeComboFields: [],
    activeAuras: [],
    comboProgress: { Projectile: 0, Whirl: 0 },
    pistolBullets: {
      Fire: Boolean(configuredBullets.Fire),
      Water: Boolean(configuredBullets.Water),
      Air: Boolean(configuredBullets.Air),
      Earth: Boolean(configuredBullets.Earth),
    },
    dazingDischargeUntil: 0,
    shatteringStoneHitsRemaining: 0,
    shatteringStoneUntil: 0,
    hammerOrbs: { Fire: null, Water: null, Air: null, Earth: null },
    hammerOrbGrantedBy: { Fire: null, Water: null, Air: null, Earth: null },
    hammerOrbActivationIds: {
      Fire: null,
      Water: null,
      Air: null,
      Earth: null,
    },
    hammerOrbBuffUntil: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
    hammerOrbLastCastAt: Number.NEGATIVE_INFINITY,
    etchings: {},
    rockBarrierExpiresAt: 0,
    spearNextDamageBonus: false,
    spearNextRechargeReduction: false,
    spearNextGuaranteedCritical: false,
    spearNextControlHit: false,
    spearFollowups: {},
    conjureEquipped: null,
    conjurePickups: {},
    signetOfFireDisabledUntil: 0,
    catalystBaseEmpowermentActive: false,
    availableFlips: {},
    summonedElemental: {
      element: null,
      summonGeneration: 0,
      actionGeneration: 0,
      activeUntil: 0,
      busyUntil: 0,
      nextActionAt: 0,
      flameBurstReadyAt: 0,
      currentActivationId: null,
      started: false,
    },
    procReadyAt: {},
    unravelUntil: 0,
    arcaneEchoUntil: 0,
  };
}

export function elementalistCoreState(
  context: SchedulerRecord,
): ElementalistCoreState {
  const state = context.state as
    { profession?: { core?: ElementalistCoreState } } | undefined;
  const runtime = context.runtime as
    { profession?: { core?: ElementalistCoreState } } | undefined;
  const profession = context.profession as
    { core?: ElementalistCoreState } | undefined;
  const core =
    state?.profession?.core || runtime?.profession?.core || profession?.core;
  if (!core) throw new TypeError("Elementalist Core state is unavailable.");
  return core;
}

export function setElementalistAttunementReadyAt(
  context: SchedulerRecord,
  attunement: ElementalistAttunement,
  readyAt: number,
): void {
  const state = elementalistCoreState(context);
  state.attunementReadyAt[attunement] = readyAt;
  const schedulerState = context.state as
    { time?: number; cooldowns?: Map<number, number> } | undefined;
  const cooldowns = schedulerState?.cooldowns;
  if (!cooldowns) return;
  const skillId = ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement];
  if (readyAt > Number(schedulerState.time || 0)) {
    cooldowns.set(skillId, readyAt);
  } else {
    cooldowns.delete(skillId);
  }
}

export function resetElementalistAttunementCooldowns(
  context: SchedulerRecord,
): void {
  const at = Number(
    (context.state as { time?: number } | undefined)?.time || context.time || 0,
  );
  for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
    setElementalistAttunementReadyAt(context, attunement, at);
  }
}

export const ELEMENTALIST_PUBLIC_END_STATE_KEYS = Object.freeze([
  "primaryAttunement",
  "secondaryAttunement",
  "attunementReadyAt",
  "autoattackChains",
  "autoattackCarryover",
  "endurance",
  "activeComboFields",
  "activeAuras",
  "pistolBullets",
  "dazingDischargeUntil",
  "shatteringStoneHitsRemaining",
  "shatteringStoneUntil",
  "hammerOrbs",
  "hammerOrbGrantedBy",
  "hammerOrbBuffUntil",
  "hammerOrbLastCastAt",
  "etchings",
  "rockBarrierExpiresAt",
  "spearNextDamageBonus",
  "spearNextRechargeReduction",
  "spearNextGuaranteedCritical",
  "spearNextControlHit",
  "conjureEquipped",
  "conjurePickups",
  "signetOfFireDisabledUntil",
  "catalystBaseEmpowermentActive",
  "availableFlips",
  "summonedElemental",
  "unravelUntil",
  "weaveSelfUntil",
  "weaveSelfVisited",
  "perfectWeaveUntil",
  "ferventStanceUntil",
  "energy",
  "maximumEnergy",
  "sphereActiveUntil",
  "sphereExpiry",
  "element",
  "charges",
  "maximumCharges",
  "empowered",
  "electricEnchantmentStacks",
  "elementalBalanceProgress",
  "elementalBalanceUntil",
] as const);

const ELEMENTALIST_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<SchedulerRecord> =
  Object.freeze({
    primaryAttunement: "Fire",
    secondaryAttunement: null,
    attunementReadyAt: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
    autoattackChains: {},
    autoattackCarryover: null,
    endurance: 100,
    activeComboFields: [],
    activeAuras: [],
    pistolBullets: { Fire: false, Water: false, Air: false, Earth: false },
    dazingDischargeUntil: 0,
    shatteringStoneHitsRemaining: 0,
    shatteringStoneUntil: 0,
    hammerOrbs: { Fire: null, Water: null, Air: null, Earth: null },
    hammerOrbGrantedBy: { Fire: null, Water: null, Air: null, Earth: null },
    hammerOrbBuffUntil: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
    hammerOrbLastCastAt: null,
    etchings: {},
    rockBarrierExpiresAt: 0,
    spearNextDamageBonus: false,
    spearNextRechargeReduction: false,
    spearNextGuaranteedCritical: false,
    spearNextControlHit: false,
    conjureEquipped: null,
    conjurePickups: {},
    signetOfFireDisabledUntil: 0,
    catalystBaseEmpowermentActive: false,
    availableFlips: {},
    summonedElemental: {
      element: null,
      summonGeneration: 0,
      actionGeneration: 0,
      activeUntil: 0,
      busyUntil: 0,
      nextActionAt: 0,
      flameBurstReadyAt: 0,
      currentActivationId: null,
      started: false,
    },
    unravelUntil: 0,
    weaveSelfUntil: 0,
    weaveSelfVisited: [],
    perfectWeaveUntil: 0,
    ferventStanceUntil: 0,
    energy: 0,
    maximumEnergy: 30,
    sphereActiveUntil: 0,
    sphereExpiry: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
    element: "Fire",
    charges: 0,
    maximumCharges: 6,
    empowered: 0,
    electricEnchantmentStacks: 0,
    elementalBalanceProgress: 0,
    elementalBalanceUntil: 0,
  });

export function projectElementalistEndState({
  schedulerState,
}: {
  readonly schedulerState: { readonly profession: unknown };
}): SchedulerRecord {
  const state = flattenProfessionState(
    schedulerState.profession,
  ) as SchedulerRecord;
  return Object.fromEntries(
    ELEMENTALIST_PUBLIC_END_STATE_KEYS.map((key) => [
      key,
      structuredClone(
        state[key] ?? ELEMENTALIST_PUBLIC_INACTIVE_STATE_DEFAULTS[key],
      ),
    ]),
  );
}
