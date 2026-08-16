import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { WARRIOR_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import { observeSpellbreakerEvent } from "./traits.js";

export const spellbreakerSchedulerHooks = Object.freeze({
  onEventScheduled: {
    id: "warrior.attacker-insight",
    order: 20,
    handler: observeSpellbreakerEvent,
  },
});

// Cast through an anonymous type rather than importing SpellbreakerState
// directly to avoid a circular dependency between rules and state modules.
function insightStacks(context: Gw2ModifierContext): number {
  const profession = (
    context.runtime as
      | {
          profession?: {
            specialization?: {
              kind?: string;
              state?: { attackerInsightExpiries?: number[] };
            };
          };
        }
      | undefined
  )?.profession;
  if (profession?.specialization?.kind !== "Spellbreaker") return 0;
  return (
    profession.specialization.state?.attackerInsightExpiries || []
  ).filter((expiresAt) => expiresAt > context.time).length;
}

function spellbreakerStateAt(context: Gw2ModifierContext): {
  magebaneTetherUntil?: number;
} {
  const profession = context.runtime?.profession as
    | {
        specialization?: {
          kind?: string;
          state?: { magebaneTetherUntil?: number };
        };
      }
    | undefined;
  return profession?.specialization?.kind === "Spellbreaker"
    ? profession.specialization.state || {}
    : {};
}

function activePrimaryWeapon(context: Gw2ModifierContext): string {
  const weaponSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  return String(
    weaponSet === 2
      ? context.config?.weaponSet2Primary || ""
      : context.config?.primaryWeapon || "",
  );
}

function modifyAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const result = { ...attributes } as SchedulerRecord & {
    power: number;
    precision: number;
    ferocity: number;
  };
  const bonus = insightStacks(context) * 50;
  result.power += bonus;
  result.precision += bonus;
  result.ferocity += bonus;
  return result;
}

const modifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "warrior.pure-strike",
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: "multiply",
    factor: (context) => (context.config?.target?.boonless ? 1.1 : 1.05),
    when: (context) => hasTrait(context, TRAIT.PURE_STRIKE),
  },
  {
    id: "warrior.sun-and-moon-style",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.SUN_AND_MOON_STYLE) &&
      activePrimaryWeapon(context) === "Dagger" &&
      context.config?.target?.boonless === true,
  },
  {
    id: "warrior.magebane-tether",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    order: 110,
    when: (context) =>
      hasTrait(context, TRAIT.MAGEBANE_TETHER) &&
      Number(spellbreakerStateAt(context).magebaneTetherUntil || 0) >
        context.time,
  },
]);

export const spellbreakerAttributeRules = Object.freeze({
  modifyAttributes,
  modifierRules,
});
