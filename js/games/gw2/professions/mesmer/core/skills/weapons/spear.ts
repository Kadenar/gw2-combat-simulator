/** Canonical Core mesmer skill definitions grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

export const MESMER_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<MesmerSkill>>> =
  Object.freeze({
    [ID.PSYCUT]: {
      name: 'Psycut',
      description: 'Slash your spear in front of yourself. Gain might per target struck.',
      icon: 'https://render.guildwars2.com/file/4BD3520A04710FE5C257CDED2F0C1971E02E0F5F/3379152.png',
      type: 'Weapon',
      weapon: 'Spear',
      slot: 'Weapon_1',
      cooldown: 0,
      autoattack: true,
      // Ordinary repeatable attack; excluded from player-input metrics.
      castTimeMs: 400,
      // Landing Psycut advances the chain even when its remaining recovery is cancelled.
      interruptCommitMs: 360,
      effects: [
        {
          type: 'strike',
          coefficient: 1,
          hits: 1,
          // Resolve the hit before the remaining cast recovery.
          atMs: 360,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          name: 'Damage',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.SPEAR.toLowerCase()
        }
      ]
    },
    [ID.PSYSTRIKE]: {
      name: 'Psystrike',
      description: 'Rend your foe with an upward swing. Gain might per target struck.',
      icon: 'https://render.guildwars2.com/file/0CBE4BCB69A5B2200980B4DC98BC0E6AC25675FC/3379153.png',
      type: 'Weapon',
      weapon: 'Spear',
      slot: 'Weapon_1',
      cooldown: 0,
      autoattack: true,
      // Ordinary repeatable attack; excluded from player-input metrics.
      castTimeMs: 520,
      // Preserve the landed strike and chain advance when recovery is interrupted at 440 ms.
      interruptCommitMs: 440,
      effects: [
        {
          type: 'strike',
          coefficient: 1,
          hits: 1,
          atMs: 400,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          name: 'Damage',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.SPEAR.toLowerCase()
        }
      ]
    },
    [ID.MIND_PIERCE]: {
      name: 'Mind Pierce',
      description: "Deliver a finishing thrust, breaking your opponent's mind and inflicting weakness.",
      icon: 'https://render.guildwars2.com/file/3C543ADB3D7EF49DE574040241F1B206B20CB7A0/3379154.png',
      type: 'Weapon',
      weapon: 'Spear',
      slot: 'Weapon_1',
      cooldown: 0,
      autoattack: true,
      // Ordinary repeatable attack; excluded from player-input metrics.
      castTimeMs: 560,
      // Preserve the finisher's damage when interruption only skips the remaining recovery.
      interruptCommitMs: 400,
      // The chain finisher's strike and Weakness share an impact before cast recovery ends.
      effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1.5,
          hits: 1,
          name: 'Damage',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.SPEAR.toLowerCase()
        },
        {
          type: 'condition',
          condition: CONDITION.WEAKNESS,
          stacks: 1,
          duration: 2
        }
      ])
    },
    [ID.MIND_THE_GAP]: {
      name: 'Mind the Gap',
      description:
        'Swing your spear in a circle, dealing increased damage to foes in the outer edge. Striking with the outer edge will always deal a critical hit. Create a clone and gain Clarity if you hit an enemy. If you are empowered, gain might.',
      icon: 'https://render.guildwars2.com/file/A2482595561FEE203E1E72A670F10FAB2F2FFB97/3379155.png',
      type: 'Weapon',
      weapon: 'Spear',
      slot: 'Weapon_2',
      cooldown: 5,
      // The impact uses the next action tick after 480 ms so a just-prior shatter cannot consume this clone.
      resource: {
        mode: 'add',
        count: 1,
        timingAnchor: 'castStart',
        atMs: 520
      },
      castTimeMs: 600,
      // Committed interrupts preserve the attack while its full cast still occupies the casting lane.
      interruptCommitMs: 520,
      retainsCastLockoutAfterInterrupt: true,
      effects: [
        {
          type: 'strike',
          coefficient: 1.92,
          hits: 1,
          name: 'Outer-edge damage',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.SPEAR.toLowerCase(),
          // The impact lands before the retained aftercast, alongside the clone gain.
          atMs: 520,
          timingAnchor: 'castStart',
          timingScale: 'fixed'
        },
        {
          // Mind the Gap owns the Clarity grant; a committed interruption retains its completion-time buff.
          type: 'buff',
          kind: 'clarity',
          name: 'Clarity',
          duration: 15,
          icon: new URL('@images/wiki/clarity.png', import.meta.url).href,
          audience: { recipients: RECIPIENT.SELF },
          persistsAfterInterrupt: true
        }
      ],
      // Clarity is granted at commitment while damage keeps its independent packet timestamp.
      sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.grant-clarity' } }]
    },
    [ID.IMAGINARY_INVERSION]: {
      name: 'Imaginary Inversion',
      description:
        'Cleanse conditions and evade while preparing a strong attack. If you successfully evade, heal yourself. Healing is improved if you have Clarity.',
      icon: 'https://render.guildwars2.com/file/04DD10464EFA2CC6E034CABF03D4D89427CFB4E4/3379156.png',
      type: 'Weapon',
      weapon: 'Spear',
      slot: 'Weapon_3',
      cooldown: 10,
      castTimeMs: 680,
      interruptCommitMs: 600,
      effects: [
        {
          type: 'strike',
          ticks: [{ atMs: 600, coefficient: 2.4 }],
          name: 'Damage',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.SPEAR.toLowerCase(),
          timingAnchor: 'castStart',
          timingScale: 'fixed'
        }
      ],
      sideEffects: [{ on: 'castStart', do: { type: 'mesmer.consume-clarity' } }]
    },
    [ID.PHANTASMAL_LANCER]: {
      name: 'Phantasmal Lancer',
      description:
        'Dash at your foe, removing boons from them. Leave a phantasm at your initial location that will launch a spear at your target, dealing heavy damage and crippling targets. If your phantasm strikes a crippled target, immobilize them instead. If you have Clarity, summon an additional phantasm.',
      icon: 'https://render.guildwars2.com/file/5E6C98FA3B942EE76808530B016FF5621A25764F/3379157.png',
      type: 'Weapon',
      weapon: 'Spear',
      slot: 'Weapon_4',
      cooldown: 12,
      // The summon owns its attack and conversion timeline independently of the player cast.
      phantasmTiming: {
        // Clarity agents spawn together, but their observed attacks/conversions can stagger:
        // representative per-entity offsets were damage [920, 1200] and conversion [1760, 2040].
        // Keep the single-Lancer profile until exact shatter-window fidelity needs a Clarity-only override.
        damageAtMs: 1160,
        spawnAtMs: 2040,
        // The trait blade lands about one second after the Lancer's javelin hit.
        phantasmalBladeDelayAfterSpawnMs: 120
      },
      phantasm: true,
      resource: {
        mode: 'phantasm',
        count: 1,
        clarityCount: 2
      },
      castTimeMs: 520,
      effects: [
        {
          type: 'strike',
          coefficient: 1,
          hits: 1,
          name: 'Mesmer attack',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.SPEAR.toLowerCase()
        },
        {
          type: 'strike',
          coefficient: 0.6,
          hits: 1,
          name: 'One lancer',
          actorType: ACTOR.SUMMON,
          summonKind: 'phantasm',
          weapon: 'phantasm medium',
          comboFinishers: [
            {
              ownerId: 'mesmer',
              finisherType: COMBO_FINISHER.LEAP
            }
          ]
        },
        {
          type: 'condition',
          condition: CONDITION.CRIPPLED,
          duration: 3,
          stacks: 1,
          actorType: ACTOR.SUMMON,
          summonKind: 'phantasm',
          phantasmEntityIndex: 0
        },
        {
          type: 'condition',
          condition: CONDITION.IMMOBILIZED,
          duration: 2,
          stacks: 1,
          actorType: ACTOR.SUMMON,
          summonKind: 'phantasm',
          phantasmEntityIndex: 1
        }
      ],
      sideEffects: [
        { on: 'castStart', do: { type: 'mesmer.consume-clarity' } },
        { on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }
      ]
    },
    [ID.MENTAL_COLLAPSE]: {
      name: 'Mental Collapse',
      description:
        'Teleport to your target and release a cascade of psychic energy, damaging nearby enemies. Refresh your Mind the Gap skill. The initial impact stuns foes struck if you have Clarity.',
      icon: 'https://render.guildwars2.com/file/6F07061FEB1E435935AE9269C27DA3EDF5095627/3379158.png',
      type: 'Weapon',
      weapon: 'Spear',
      slot: 'Weapon_5',
      cooldown: 20,
      shadowstepSkill: true,
      peithaImpactDelayMs: 800,
      castTimeMs: 640,
      interruptCommitMs: 600,
      effects: [
        {
          // Only the initial impact stuns when this activation consumed Clarity.
          type: 'control',
          source: 'Player',
          controlKind: CONTROL.STUN,
          actorType: ACTOR.PLAYER,
          atMs: 560,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          when: (runtime: MechanicQueryContext<MesmerRuntimeState>, cast) =>
            Boolean(runtime.profession.core.castDetails.get(cast.id)?.clarityConsumed)
        },
        {
          type: 'strike',
          // Once committed, all three impacts survive interruption of the remaining recovery.
          persistsAfterInterrupt: true,
          ticks: [
            { atMs: 560, coefficient: 1 },
            { atMs: 840, coefficient: 1 },
            { atMs: 1120, coefficient: 1 }
          ],
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          name: 'Damage',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.SPEAR.toLowerCase(),
          comboFinishers: [
            {
              ownerId: 'mesmer',
              finisherType: COMBO_FINISHER.BLAST
            }
          ]
        }
      ],
      // A committed cast resets Mind the Gap even when the remaining animation is interrupted.
      sideEffects: [
        { on: 'castStart', do: { type: 'mesmer.consume-clarity' } },
        { on: 'castCommit', do: { type: 'rechargeReset', skillIds: [ID.MIND_THE_GAP] } }
      ]
    }
  });
