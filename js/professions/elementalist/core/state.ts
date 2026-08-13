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
  burningPrecisionProgress: number;
  bountifulPowerProgress: number;
  criticalProcProgress: Record<string, number>;
  endurance: number;
  enduranceUpdatedAt: number;
  activeComboFields: ElementalistFieldState[];
  activeAuras: ElementalistAuraState[];
  comboProgress: Record<string, number>;
  pistolBullets: Record<ElementalistAttunement, boolean>;
  hammerOrbs: Record<ElementalistAttunement, number | null>;
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
    hammerOrbs: { Fire: null, Water: null, Air: null, Earth: null },
    procReadyAt: {},
    unravelUntil: 0,
    arcaneEchoUntil: 0,
  };
}

export function elementalistCoreState(
  context: SchedulerRecord,
): ElementalistCoreState {
  const state = context.state as
    | { profession?: { core?: ElementalistCoreState } }
    | undefined;
  const runtime = context.runtime as
    | { profession?: { core?: ElementalistCoreState } }
    | undefined;
  const profession = context.profession as
    | { core?: ElementalistCoreState }
    | undefined;
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
    | { time?: number; cooldowns?: Map<number, number> }
    | undefined;
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
  "hammerOrbs",
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
    hammerOrbs: { Fire: null, Water: null, Air: null, Earth: null },
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
