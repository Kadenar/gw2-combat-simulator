import type { ProfessionAppContract } from '#gw2/app/types.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import type { NativeProfessionRuntimeState } from '#gw2/platform/profession-definition/module-types.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2PlanningStateInput, Gw2ProfessionSource } from '#gw2/platform/simulation/types.js';

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
        onCastCommit(runtime: MechanicContext<{ core: { coreValue: number } }>, cast) {
          runtime.profession.core.coreValue += cast.skill.id === 1 ? 1 : 0;
        },
        modifyEffects: (_runtime, _cast, effects) => effects
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
