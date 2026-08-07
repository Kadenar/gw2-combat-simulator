import {
  defineNativeModule,
  defineNativeProfession,
  onResolvedDamage,
  skillAvailability,
  type NativeProfessionRuntimeState,
} from "./native-profession.js";
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from "./types.js";

type Assert<T extends true> = T;
type Equal<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends
  (<T>() => T extends TRight ? 1 : 2) ? true : false;

const core = defineNativeModule({
  id: "Core",
  data: {},
  state: {
    scheduler: () => ({ coreValue: 1 }),
    resolver: () => ({ resolvedCoreValue: 2 }),
  },
  mechanics: {
    availability: skillAvailability({
      id: "fixture.available",
      handler: () => ({ ready: true }),
    }),
    reactions: [onResolvedDamage<
      Gw2ResolverRuntime,
      Gw2ResolverEvent
    >({
      id: "fixture.damage",
      handler: () => undefined,
    })],
  },
});

const elite = defineNativeModule({
  id: "Elite",
  data: {},
  state: { scheduler: () => ({ eliteValue: "active" as const }) },
});

const profession = defineNativeProfession({
  id: "fixture",
  name: "Fixture",
  modules: [core, elite],
});

type Modules = readonly [typeof core, typeof elite];
type RuntimeState = NativeProfessionRuntimeState<Modules>;
type NativeAuthoringAssertions = [
  Assert<Equal<typeof profession.specializationIds[number], "Elite">>,
  Assert<Equal<RuntimeState["core"]["coreValue"], number>>,
  Assert<Equal<RuntimeState["specialization"]["kind"], "Core" | "Elite">>,
  Assert<Equal<
    Extract<RuntimeState["specialization"], { kind: "Elite" }>["state"]["eliteValue"],
    "active"
  >>,
];

export type NativeProfessionAuthoringAssertions = NativeAuthoringAssertions;

// Compile-time negative assertions must not execute when Node discovers this
// emitted file as a test module.
if (false) {
  defineNativeProfession({
    id: "invalid-order",
    name: "Invalid order",
    // @ts-expect-error Native professions require Core as the first module.
    modules: [elite, core],
  });

  defineNativeModule({
    id: "InvalidState",
    data: {},
    state: {
      // @ts-expect-error Scheduler state factories must return an object.
      scheduler: () => 1,
    },
  });

  defineNativeModule({
    id: "InvalidReaction",
    data: {},
    state: { scheduler: () => ({}) },
    mechanics: {
      reactions: [{
        // @ts-expect-error Resolver declarations cannot claim the scheduler phase.
        phase: "scheduler",
        eventType: "damage",
        id: "invalid.phase",
        order: 0,
        handler: () => undefined,
      }],
    },
  });
}
