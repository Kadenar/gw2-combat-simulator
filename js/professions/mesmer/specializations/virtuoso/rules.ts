import { MESMER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { illusionSource, timedActive } from "../../core/rules.js";
import { mesmerRuntimeFor } from "../../core/runtime.js";
import { initializeVirtuosoRuntime } from "./runtime.js";
import type { Gw2ModifierRule } from "../../../../platform/gw2/types.js";
import type {
  MesmerSchedulerContext,
  MesmerSchedulerTask,
} from "../../types.js";

export const virtuosoModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "mesmer.quiet-intensity-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.15,
    when: (context) =>
      !illusionSource(context) &&
      hasTrait(context, TRAIT.QUIET_INTENSITY) &&
      Boolean(
        context.query?.furyActiveAt(
          context.time,
          context.runtime,
          context.event,
        ),
      ),
  },
  {
    id: "mesmer.deadly-blades",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: (_context, target) =>
      target === MODIFIER_TARGET.CONDITION_DAMAGE ? 0.1 : 0.05,
    when: (context) =>
      !illusionSource(context) && timedActive(context, "deadly-blades"),
  },
  {
    id: "mesmer.infinite-forge",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.07,
    order: 100,
    when: (context) =>
      Boolean(context.event?.blade) && hasTrait(context, TRAIT.INFINITE_FORGE),
  },
  {
    id: "mesmer.mental-focus",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.05,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.MENTAL_FOCUS) &&
      Boolean(context.config?.target?.nearby) &&
      context.event?.source === "Player",
  },
  {
    id: "mesmer.bloodsong",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "multiply",
    factor: 1.25,
    order: 100,
    when: (context) =>
      context.condition === "Bleeding" && hasTrait(context, TRAIT.BLOODSONG),
  },
]);

export function handleBladeSpendTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<"bladeSpend">,
): void {
  const runtime = mesmerRuntimeFor(context);
  const details = runtime.castDetails.get(task.payload.reservationId);
  if (!details || details.shatterSpendCommitted) return;
  details.shatterSpent = runtime.actions.commitReservedResources(
    task.at,
    Number(details.shatterSpent || 0),
    {
      sourceSkill: task.payload.sourceSkill,
      rotationIndex: task.payload.rotationIndex,
    },
  );
  details.shatterSpendCommitted = true;
}

export function handleInfiniteForgeTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<"infiniteForge">,
): void {
  const runtime = mesmerRuntimeFor(context);
  runtime.resources.gainResources(
    task.at,
    1,
    runtime.activePrimaryWeapon(),
    "Infinite Forge",
    {
      traitId: TRAIT.INFINITE_FORGE,
      traitName: "Infinite Forge",
    },
  );
  context.tasks.schedule({
    type: "mesmer.infinite-forge",
    at: task.at + 3,
    priority: -20,
    ownerId: "mesmer.infinite-forge",
    payload: {},
  });
}

export const virtuosoSchedulerHooks = Object.freeze({
  taskHandlers: Object.freeze({
    "mesmer.blade-spend": handleBladeSpendTask,
    "mesmer.infinite-forge": handleInfiniteForgeTask,
  }),
});

export const virtuosoAttributeRules = Object.freeze({
  modifierRules: virtuosoModifierRules,
});

export const virtuosoRuntimeHooks = Object.freeze({
  ...virtuosoSchedulerHooks,
  initialize: initializeVirtuosoRuntime,
});
