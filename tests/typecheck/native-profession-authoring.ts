import type { ProfessionAppContract } from '#gw2/app/types.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import type { NativeProfessionRuntimeState } from '#gw2/platform/profession-definition/module-types.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';

type Assert<T extends true> = T;
type Equal<TLeft, TRight> = (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? true : false;

const core = defineNativeModule({
  id: 'Core',
  data: { traits: [{ id: 1, name: 'Typed trait' }] },
  // Trait callbacks retain typed runtime state and discriminated cast/resolved-hit boundaries.
  traitDefinitions: [
    defineTrait({
      id: 1,
      name: 'Typed trait',
      balance: { effects: [] },
      triggers: [
        {
          on: 'damage.resolved',
          emit: 1,
          when: (_runtime, event, details) => event.actorType === 'player' && Boolean(details.hitContext?.critEligible)
        }
      ],
      hooks: {
        modifyEffects: (_runtime, _cast, effects) => effects
      },
      lifetime: {
        onCastCommit(runtime: MechanicContext<{ core: { coreValue: number } }>, cast) {
          runtime.profession.core.coreValue += cast.skill.id === 1 ? 1 : 0;
        }
      },
      buildAttributes: (_common, { balanceContext }) => ({
        attributeEffects: [
          {
            kind: 'flat',
            to: 'Power',
            amount: balanceContext.catalog.balanceProfiles.length,
            feedsConversions: false
          }
        ]
      })
    })
  ],
  state: {
    create: () => ({ coreValue: 1, resolvedCoreValue: 2 })
  },
  hooks: {
    initialize(runtime: MechanicContext<{ core: { coreValue: number; resolvedCoreValue: number } }>) {
      // Hook callbacks consume the canonical state shape used by the family factory.
      runtime.profession.core.coreValue += runtime.profession.core.resolvedCoreValue;
    },
    availability: () => ({ ready: true }),
    reactions: { 'damage.resolved': () => undefined }
  }
});

const elite = defineNativeModule({
  id: 'Elite',
  data: {},
  state: { create: () => ({ eliteValue: 'active' as const }) }
});

const profession = defineNativeProfession({
  id: 'fixture',
  name: 'Fixture',
  modules: [core, elite]
});

const applicationProfession = withPatchPreview(profession, null);

type Modules = readonly [typeof core, typeof elite];
type RuntimeState = NativeProfessionRuntimeState<Modules>;
type NativeAuthoringAssertions = [
  Assert<Equal<Extract<keyof Gw2PlanningStateInput, 'schedulerState' | 'schedulerContext' | 'queue'>, never>>,
  Assert<Equal<RuntimeState['core']['coreValue'], number>>,
  Assert<Equal<ReturnType<ReturnType<typeof profession.runtimeFor>['createState']>, RuntimeState>>,
  Assert<Equal<RuntimeState['specialization']['kind'], 'Core' | 'Elite'>>,
  Assert<Equal<Extract<RuntimeState['specialization'], { kind: 'Elite' }>['state']['eliteValue'], 'active'>>,
  Assert<typeof applicationProfession extends ProfessionAppContract ? true : false>,
  Assert<typeof profession extends Gw2ProfessionSource ? true : false>,
  Assert<
    Equal<
      Parameters<NonNullable<ReturnType<typeof profession.runtimeFor>['eventHandlers']>[string]>[0]['profession'],
      RuntimeState
    >
  >,
  Assert<
    Equal<
      Parameters<
        NonNullable<NonNullable<ReturnType<typeof profession.runtimeFor>['reactions']>['damage.resolved']>
      >[0]['profession'],
      RuntimeState
    >
  >
];

export type NativeProfessionAuthoringAssertions = NativeAuthoringAssertions;

if (false) {
  // Mechanic facts are checked at both admission and listener registration, without a generic event envelope.
  const accepted = defineTriggerPoint<{ readonly cast: RuntimeCast; readonly stacks: number }>('fixture.accepted', [2]);
  const resolved = defineTriggerPoint<{ readonly cause: Gw2ResolverEvent }>('fixture.resolved', [2]);
  onTriggerPoint(accepted, {
    run(runtime, input) {
      runtime.fireTrigger(accepted, { cast: input.cast, stacks: input.stacks });
      // @ts-expect-error The point's accepted cast is required; inference cannot widen the declared input.
      runtime.fireTrigger(accepted, { stacks: 1 });
      // @ts-expect-error Captured stacks have their declared type.
      runtime.fireTrigger(accepted, { cast: input.cast, stacks: 'one' });
    }
  });
  onTriggerPoint(resolved, { emit: 2, attribution: (_runtime, input) => ({ activationId: input.cause.activationId }) });
  // @ts-expect-error Declarative delivery requires a cause on the point input.
  onTriggerPoint(accepted, { emit: 2 });
  onTriggerPoint(accepted, {
    // @ts-expect-error A callback cannot substitute a different point input.
    run: (_runtime, input: { readonly cause: Gw2ResolverEvent }) => void input.cause
  });
  onTriggerPoint(accepted, {
    run: () => undefined,
    // @ts-expect-error The mechanic owns point listener ordering.
    order: 1
  });
  defineTrait({
    id: 2,
    name: 'Untyped point',
    triggers: [
      // @ts-expect-error Bind the listener to its point before storing it in a trait.
      { on: accepted, run: () => undefined }
    ]
  });
  defineTrait({
    id: 2,
    name: 'Raw activation',
    hooks: {
      // @ts-expect-error New cast rewards must use compiled triggers.
      onCastCommit: () => undefined
    }
  });
  defineTrait({
    id: 2,
    name: 'Raw startup',
    hooks: {
      // @ts-expect-error Combat startup is a mechanic-owned trigger point.
      onCombatStart: () => undefined
    }
  });
  defineTrait({
    id: 2,
    name: 'Raw reaction',
    hooks: {
      // @ts-expect-error Raw reactions must be explicitly retained lifetime work.
      reactions: { 'damage.resolved': () => undefined }
    }
  });
  defineTrait({
    id: 2,
    name: 'Unsupported lifetime producer',
    lifetime: {
      // @ts-expect-error Lifetime handlers cannot register startup.
      initialize: () => undefined
    }
  });
  defineTrait({
    id: 2,
    name: 'Unsupported lifetime reaction',
    lifetime: {
      reactions: {
        // @ts-expect-error No retained condition admission handler exists; use a trigger.
        'condition.applied': () => undefined
      }
    }
  });
  defineTrait({
    id: 2,
    name: 'Supplied state',
    hooks: {
      initialize(context) {
        // @ts-expect-error Importing supplied state cannot admit a new task.
        context.schedule('fixture.proc', 0, {});
        // @ts-expect-error Importing supplied state cannot admit a new reward.
        context.effects.emit({ kind: 'packet', event: {} });
      }
    }
  });
  defineTrait({
    id: 2,
    name: 'Read-only transforms',
    hooks: {
      prepareEvent(context, event) {
        // @ts-expect-error A value transform cannot enqueue a separate reward.
        context.effects.emit({ kind: 'packet', event });
        return event;
      },
      modifyEffects(context, _cast, effects) {
        // @ts-expect-error A value transform cannot schedule new work.
        context.schedule('fixture.proc', 0, {});
        return effects;
      }
    }
  });
  defineTrait({
    id: 2,
    name: 'Invalid ownership',
    triggers: [
      {
        on: 'castCommit',
        emit: 2,
        when: () => true,
        // @ts-expect-error The enclosing trait owns the selection gate.
        trait: 3
      }
    ]
  });
  defineTrait({
    id: 2,
    name: 'Invalid hook',
    hooks: {
      // @ts-expect-error Trait hooks cannot replace profession resource policies.
      resources: {}
    }
  });
  defineTrait({
    id: 2,
    name: 'Invalid transform',
    hooks: {
      // @ts-expect-error Effect transforms must return effects, not a notification result.
      modifyEffects: () => undefined
    }
  });
  defineNativeProfession({
    id: 'invalid-order',
    name: 'Invalid order',
    // @ts-expect-error Native professions require Core as the first module.
    modules: [elite, core]
  });

  defineNativeModule({
    id: 'InvalidState',
    data: {},
    state: {
      // @ts-expect-error Canonical state factories must return an object.
      create: () => 1
    }
  });

  defineNativeModule({
    id: 'ObsoleteState',
    data: {},
    state: {
      create: () => ({}),
      // @ts-expect-error Separate resolver state factories are no longer supported.
      resolver: () => ({})
    }
  });

  defineNativeModule({
    id: 'InvalidReaction',
    data: {},
    state: { create: () => ({}) },
    // @ts-expect-error Modules no longer declare a separate execution or resolution engine.
    resolution: {
      reactions: [
        {
          phase: 'scheduler',
          eventType: 'damage',
          id: 'invalid.phase',
          order: 0,
          handler: () => undefined
        }
      ]
    }
  });

  defineNativeModule({
    id: 'LegacyHandlers',
    data: {
      // @ts-expect-error Procedural skill handlers have been retired.
      handlers: {}
    },
    state: { create: () => ({}) }
  });

  defineNativeModule({
    id: 'LegacyReactions',
    data: {},
    state: { create: () => ({}) },
    // @ts-expect-error Reactions belong under hooks.
    reactions: []
  });
}
