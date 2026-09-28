import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { applyAimAssistedRocket } from '#gw2/professions/engineer/core/traits/explosives.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';
/** Core Engineer Flamethrower skill mechanics. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

const NAPALM_TICK_OFFSETS_MS = [280, 440, 560, 680, 840, 960, 1080, 1240, 1360, 1480];

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Flamethrower. */
export const ENGINEER_FLAMETHROWER_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.FLAMETHROWER]: {
    // Custom: Equips the kit and updates bundle/weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }],
    kitTransition: 'equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Flamethrower'
  },
  [ID.FLAME_JET]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 1720,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [160, 360, 520, 680, 880, 1040, 1200, 1360, 1560, 1720].map((atMs) => ({ atMs, coefficient: 2.5 / 10 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Flame Jet',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ],
    kit: 'Flamethrower'
  },
  [ID.NAPALM]: {
    castTimeMs: 1760,
    cooldown: 25,
    // Napalm fires independent volleys, so interruption retains only packets launched before the cutoff.
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // The EVTC records five visual volleys as ten damage packets. Each
        // packet has a 0.5 coefficient and a matching Burning application.
        ticks: NAPALM_TICK_OFFSETS_MS.map((atMs) => ({ atMs, coefficient: 0.5 })),
        name: 'Napalm',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: NAPALM_TICK_OFFSETS_MS.map((atMs) => ({ atMs, condition: 'Burning', stacks: 1, duration: 3.25 })),
        actorType: 'player'
      }
    ]),
    kit: 'Flamethrower'
  },
  [ID.AIR_BLAST]: {
    castTimeMs: 360,
    cooldown: 15,
    effects: [
      {
        // Custom: Burning and missile procs require an already-burning target at impact; the handler below preserves that live check.
        type: 'custom',
        eventType: 'engineer.air-blast',
        event: { condition: 'Burning', stacks: 1, duration: 5, projectile: true },
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockback'
      }
    ],
    kit: 'Flamethrower'
  },
  [ID.FLAME_BLAST]: {
    castTimeMs: 800,
    cooldown: 6,
    // The blast lands at 520 ms after its earlier commit while the cast keeps its full lockout.
    retainsCastLockoutAfterInterrupt: true,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 1.3,
          hits: 1,
          name: 'Flame Blast',
          interruptCommitMs: 480,
          actorType: 'player',
          comboFinishers: [
            {
              ownerId: 'engineer',
              finisherType: 'Blast',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          damageKind: 'explosion'
        },
        {
          type: 'condition',
          condition: 'Burning',
          stacks: 1,
          duration: 6,
          interruptCommitMs: 480,
          actorType: 'player'
        }
      ]
    ),
    kit: 'Flamethrower'
  },
  [ID.STOW_FLAMETHROWER]: {
    // Custom: Stows the active kit and restores weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }],
    kitTransition: 'stow',
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Flamethrower'
  },
  [ID.SMOKE_VENT]: {
    castTimeMs: 0,
    cooldown: 15,
    effects: [
      {
        type: 'blind',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Flamethrower'
  },
  [ID.STOKE_THE_FLAMES]: {
    castTimeMs: 440,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: 'Fire',
        duration: 1,
        startAnchor: 'castStart',
        startMs: 360,
        inclusiveExpiry: true
      }
    ],
    // The hit, Burning, boons, and fire field resolve around 360 ms, two ticks before the cast completes.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Stoke the Flames',
        actorType: 'player'
      },
      {
        // One authored total becomes independent Burning applications in the shared resolver.
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 8
      }
    ]),
    kit: 'Flamethrower'
  }
});

/** Air Blast's Burning missile exists only against a target still burning at impact; knockback resolves separately. */
export function handleAirBlast(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (!context.query.targetHasCondition('Burning', event.at, context)) return;
  // Materialize the deferred missile without importing unrelated proc or strike state from its trigger.
  context.applyCondition(
    buildResolverCondition({
      at: event.at,
      priority: event.priority,
      source: event.source,
      sourceId: event.sourceId,
      actorType: event.actorType,
      ownerActorType: event.ownerActorType,
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Air Blast — Burning',
      activationId: event.activationId,
      condition: String(event.condition),
      stacks: Number(event.stacks),
      duration: Number(event.duration),
      projectile: true,
      applicationIndex: event.applicationIndex,
      totalApplications: event.totalApplications
    })
  );
  applyAimAssistedRocket(context, event);
}

/** Flame Jet samples Burning on each impact and retains additive damage stacking. */
export const flameJetModifier: Gw2ModifierRule = {
  id: 'engineer.flame-jet-burning-target',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'damage-additive',
  amount: 0.1,
  when: (context) => context.event?.skillId === ID.FLAME_JET && targetConditionActive(context, 'Burning')
};
