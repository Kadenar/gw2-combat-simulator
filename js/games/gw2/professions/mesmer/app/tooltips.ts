import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  profileFact,
  modifierFact,
  tooltipPercent,
  tooltipDecimal,
  tooltipNumber,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import {
  MESMER_CORE_BALANCE_PROFILE_IDS as CORE,
  MESMER_CORE_SHATTER_PROFILE_IDS
} from '#gw2/professions/mesmer/core/profiles.js';
import {
  CHRONOMANCER_BALANCE_PROFILE_IDS as CHRONO,
  CHRONOMANCER_SHATTER_PROFILE_IDS
} from '#gw2/professions/mesmer/specializations/chronomancer/profiles.js';
import { VIRTUOSO_SHATTER_PROFILE_IDS } from '#gw2/professions/mesmer/specializations/virtuoso/profiles.js';
import {
  MIRAGE_BALANCE_PROFILE_IDS as MIRAGE,
  MIRAGE_AMBUSH_PROFILE_IDS,
  mesmerProfiledAmbush
} from '#gw2/professions/mesmer/specializations/mirage/profiles.js';
import { MESMER_MIRAGE_AMBUSH_SKILLS } from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';
import {
  TROUBADOUR_BALANCE_PROFILE_IDS as TROUBADOUR,
  TROUBADOUR_INSTRUMENT_PROFILE_IDS
} from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';
import {
  MESMER_CORE_SHATTERS,
  MESMER_CORE_PHANTASM_ATTACK_TIMINGS
} from '#gw2/professions/mesmer/core/mechanics/definitions.js';
import {
  MESMER_CHRONOMANCER_SHATTERS,
  MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS
} from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/definitions.js';
import { MESMER_VIRTUOSO_SHATTERS } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/definitions.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { DescribeSimulationTooltip } from '#gw2/app/shared/simulation-tooltip.js';

// Resource tiers are alternatives; ordinary clone shatters count the player as an additional source.
const shatterTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const id = Number(entity.id);
  const bladesong = VIRTUOSO_SHATTER_PROFILE_IDS[id] != null;
  const definition = { ...MESMER_CORE_SHATTERS, ...MESMER_CHRONOMANCER_SHATTERS, ...MESMER_VIRTUOSO_SHATTERS }[id];
  const profile = tooltipProfile(
    balanceContext,
    { ...MESMER_CORE_SHATTER_PROFILE_IDS, ...CHRONOMANCER_SHATTER_PROFILE_IDS, ...VIRTUOSO_SHATTER_PROFILE_IDS }[id]
  );
  const native = balanceContext.catalog.skillsById.get(entity.id)!;
  // Resolve by resource tier so removing a strike cannot relabel its surviving neighbors.
  const facts = definition.coefficients.flatMap((_, tier) => {
    const idProfile = requireBalanceProfileFromContext(balanceContext, profile.id);
    const effect = requireEffect(idProfile, 'strike', `${tier} resources`);
    if (bladesong && tier === 0) return [];
    const sources = bladesong ? tier : tier + 1;
    const qualifier = `${tier} ${bladesong ? 'blades' : 'clones'} spent`;
    const strike = bladesong
      ? definition.kind !== 'blade-defense'
      : definition.kind === 'power' || definition.kind === 'confusion';
    return simulationEffectFacts(
      [
        ...(strike && effect
          ? [
              {
                ...effect,
                name: undefined,
                coefficient:
                  effect.ticks?.reduce((sum, tick) => sum + tooltipNumber(tick, 'coefficient'), 0) ??
                  effect.coefficient,
                ticks: undefined,
                hits: bladesong ? (effect.ticks?.length ?? 1) : (effect.ticks?.length ?? 1) * sources
              }
            ]
          : []),
        ...(profile.effects || [])
          .filter((effect) => effect.type === 'condition')
          .map((effect) => ({ ...effect, applications: sources })),
        ...(native.effects || [])
          .filter((effect) => effect.type === 'control')
          .map((effect) => ({ ...effect, applications: bladesong ? 1 : sources }))
      ],
      qualifier
    ).facts;
  });
  if (profile.rechargeReduction != null)
    facts.push(
      profileFact(
        balanceContext,
        profile.id,
        'rechargeReduction',
        'Recharge reduction per shatter source',
        tooltipSeconds
      )
    );
  return {
    description: bladesong
      ? 'Spend your stocked blades to perform this bladesong. Its attack depends on the number spent. Eligible bladesong and shatter traits apply; Distortion has no direct damage in the simulation.'
      : 'Shatter your active clones, with an additional effect from yourself. The listed tiers are alternatives based on clones spent. Shatter traits can add conditions, boons, or further effects.',
    facts
  };
};

// Phantasm condition budgets are distributed across their authored hit packets, independently for each summoned entity.
const phantasmTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)! as MesmerSkill;
  const timing = { ...MESMER_CORE_PHANTASM_ATTACK_TIMINGS, ...MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS }[
    selected.id
  ];
  const facts = (selected.effects || []).flatMap((effect) => {
    const companion = effect.actorType === 'summon';
    const entityIndex = effect.type === 'condition' ? effect.phantasmEntityIndex : undefined;
    const packetLabel = effect.type === 'condition' ? effect.packetLabel : undefined;
    const packetCount = packetLabel
      ? (
          timing?.damageTicksByEntity?.[entityIndex ?? 0]?.[packetLabel] ??
          timing?.damageTicks?.[packetLabel] ??
          selected.effects?.filter((effect) => effect.type === 'strike').find((effect) => effect.name === packetLabel)
            ?.ticks
        )?.length
      : undefined;
    const formatted =
      effect.type === 'condition' && packetCount
        ? { ...effect, stacks: (effect.stacks ?? 1) / packetCount, applications: packetCount }
        : effect;
    return simulationEffectFacts(
      [formatted],
      companion ? (entityIndex == null ? 'per phantasm' : `phantasm ${entityIndex + 1} only`) : 'player effect'
    ).facts;
  });
  facts.push({ name: 'Base phantasms summoned', detail: tooltipDecimal(tooltipNumber(selected.resource!, 'count')) });
  return {
    description:
      "Summon phantasms that perform their own attacks before converting into your specialization's resource. Player effects occur once; companion effects are per phantasm. Traits can change the count, repeat attacks, or modify conversion." +
      (selected.id === ID.PHANTASMAL_LANCER
        ? ' Consuming Clarity summons an additional Lancer; only that second phantasm immobilizes.'
        : ''),
    facts
  };
};

const cloakFacts = (balanceContext: Parameters<DescribeSimulationTooltip>[0]) => [
  profileFact(balanceContext, MIRAGE.mechanics, 'durationMultiplier', 'Mirage Cloak', tooltipSeconds),
  profileFact(balanceContext, MIRAGE.mechanics, 'durationPerTier', 'Ambush window', tooltipSeconds)
];

/** Descriptions follow the simulated actor, shatter tier, and instrument branch rather than imported game text. */
export const mesmerTooltips: ProfessionTooltips = {
  skillFacts: (_c, entity) => {
    const selected = entity as MesmerSkill;
    return [
      ...(selected.resource?.mode === 'add'
        ? [
            {
              name: 'Resources generated',
              detail: `${tooltipDecimal(tooltipNumber(selected.resource, 'count'))} clones, blades, or notes according to specialization`
            }
          ]
        : []),
      ...(selected.flipDuration == null
        ? []
        : [{ name: 'Follow-up window', detail: tooltipSeconds(selected.flipDuration) }]),
      ...(selected.parentCooldownIncrease == null
        ? []
        : [{ name: 'Additional parent recharge', detail: tooltipSeconds(selected.parentCooldownIncrease) }]),
      ...(selected.resourceCost == null
        ? []
        : [{ name: 'Endurance spent', detail: tooltipDecimal(tooltipNumber(selected, 'resourceCost')) }])
    ];
  },

  // Bind native mechanic descriptions to their canonical skill identities.
  skills: {
    ...Object.fromEntries(
      Object.keys(MESMER_CORE_PHANTASM_ATTACK_TIMINGS).map((id) => [
        Number(id),
        phantasmTooltip as DescribeSimulationTooltip
      ])
    ),
    ...Object.fromEntries(
      Object.keys({ ...MESMER_CORE_SHATTERS, ...MESMER_CHRONOMANCER_SHATTERS }).map((id) => [
        Number(id),
        shatterTooltip as DescribeSimulationTooltip
      ])
    ),
    ...Object.fromEntries(
      Object.keys(MESMER_VIRTUOSO_SHATTERS).map((id) => [Number(id), shatterTooltip as DescribeSimulationTooltip])
    ),
    [ID.SWAP_WEAPONS]: skillTooltip(
      'Switch weapon sets. Existing illusions keep their own weapons and attack patterns.'
    ),
    [ID.AXES_OF_SYMMETRY]: skillTooltip(
      'Strike and confuse your target. Each axe clone present when the cast begins performs its own additional strike and applies confusion.'
    ),
    [ID.MENTAL_COLLAPSE]: skillTooltip(
      'Strike your target and reset Mind the Gap. Consuming Clarity also stuns the target.',
      (_c, entity) =>
        simulationEffectFacts((entity as MesmerSkill).clarityEffects, 'additional effect with Clarity').facts
    ),
    [ID.INSPIRING_IMAGERY]: (balanceContext, entity) => ({
      description:
        'Create an ethereal field and open Abstraction. If the image expires naturally, gain its boons. Detonating it with Abstraction ends the field and replaces this boon outcome with the follow-up attack.',
      facts: simulationEffectFacts(balanceContext.catalog.skillsById.get(entity.id)!.effects, 'on natural expiry only')
        .facts
    }),
    [ID.CONTINUUM_SPLIT]: skillTooltip(
      'Spend your clones to open a window whose duration counts yourself and each clone spent. At expiry, restore the captured cooldown, ammunition, and autoattack-chain state. Clones, damage, and boons are not rewound. Fragmentation extends the window.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          CHRONO.continuumSplit,
          'durationPerTier',
          'Window per shatter source',
          tooltipSeconds
        )
      ]
    ),
    [ID.CONTINUUM_SHIFT]: skillTooltip(
      'End the active Continuum Split and restore its captured cooldown, ammunition, and autoattack-chain state immediately.'
    ),
    ...Object.fromEntries(
      Object.keys(MIRAGE_AMBUSH_PROFILE_IDS)
        .map((weapon) => MESMER_MIRAGE_AMBUSH_SKILLS[weapon].id)
        .map((id) => [
          Number(id),
          ((balanceContext, entity) => {
            const selected = balanceContext.catalog.skillsById.get(entity.id)!;
            const profile = tooltipProfile(balanceContext, MIRAGE_AMBUSH_PROFILE_IDS[String(selected.weapon)]);
            // Describe repeated statuses with the same independent cadence used by the runtime.
            const { player } = mesmerProfiledAmbush(
              balanceContext,
              MESMER_MIRAGE_AMBUSH_SKILLS[String(selected.weapon)],
              MIRAGE_AMBUSH_PROFILE_IDS[String(selected.weapon)]
            );
            const playerPackets = (player.ticks ?? player.statusAtMs)?.length ?? 1;
            const facts = (profile.effects || []).flatMap((effect) => {
              const clone = effect.source === 'Clone';
              const repeated =
                !clone && (effect.type === 'boon' || (effect.type === 'condition' && effect.source == null));
              return simulationEffectFacts(
                [
                  {
                    ...effect,
                    actorType: clone ? 'summon' : 'player',
                    applications: (effect.applications ?? 1) * (repeated ? playerPackets : 1),
                    ...(effect.type === 'boon'
                      ? {
                          audience: {
                            recipients: clone || selected.id === ID.CHAOS_VORTEX ? 'party' : 'self',
                            ...(clone || selected.id === ID.CHAOS_VORTEX ? { maximumRecipients: 5 } : {})
                          }
                        }
                      : {})
                  }
                ],
                clone ? 'per clone with Infinite Horizon, when cloak is granted' : 'player ambush'
              ).facts;
            });
            facts.push(...simulationEffectFacts(selected.effects?.filter((effect) => effect.type === 'control')).facts);
            return {
              description:
                "Use this weapon's ambush during the Mirage Cloak ambush window, then consume that window. With Infinite Horizon, existing clones perform their own weapon ambush when cloak is granted. Ambush traits can add further effects." +
                (selected.id === ID.MIRAGE_THRUST ? ' This player ambush also creates a clone.' : ''),
              facts
            };
          }) as DescribeSimulationTooltip
        ])
    ),
    ...Object.fromEntries(
      Object.keys(TROUBADOUR_INSTRUMENT_PROFILE_IDS).map((id) => [
        Number(id),
        ((balanceContext, entity) => ({
          description:
            "Perform this instrument's attack, then spend your notes to keep the instrument active. Additional notes extend its duration. Different instruments can overlap; a new performance replaces the same instrument's previous window. Instrument and note-spending traits apply.",
          facts: [
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, TROUBADOUR_INSTRUMENT_PROFILE_IDS[Number(entity.id)]).effects
            ).facts,
            ...simulationEffectFacts(
              balanceContext.catalog.skillsById.get(entity.id)!.effects?.filter((effect) => effect.type === 'control')
            ).facts,
            profileFact(
              balanceContext,
              TROUBADOUR.instruments,
              'durationMultiplier',
              'Base instrument duration',
              tooltipSeconds
            ),
            profileFact(
              balanceContext,
              TROUBADOUR.instruments,
              'durationPerTier',
              'Additional duration per note',
              tooltipSeconds
            ),
            ...([ID.HARMONIOUS_HARP, ID.HARMONIOUS_HARP_ALTERNATE].some((id) => id === entity.id)
              ? simulationEffectFacts(tooltipProfile(balanceContext, TROUBADOUR.instruments).effects).facts
              : [])
          ]
        })) as DescribeSimulationTooltip
      ])
    ),
    [ID.CRESCENDO]: (balanceContext) => ({
      description:
        'Strike with increased damage for each instrument still active when the attack lands. Fragmentation increases that bonus. Altered Chord adds an effect from your most recent instrument; Life of the Party grants boons, and Fortissimo generates notes over time.',
      facts: [
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, TROUBADOUR.crescendo).effects,
          'before active-instrument bonus'
        ).facts,
        profileFact(
          balanceContext,
          TROUBADOUR.crescendo,
          'damageIncreasePerStack',
          'Strike damage per active instrument',
          tooltipPercent
        )
      ]
    }),
    [ID.CHAOS_STORM]: skillTooltip(
      'Create a storm that strikes repeatedly, dazes on its opening pulse, and poisons the target on the subsequent condition pulses.',
      (_c, entity) => simulationEffectFacts([(entity as MesmerSkill).mesmerMechanic!.chaosStormPoison!]).facts
    ),
    [ID.SIGNET_OF_ILLUSIONS]: skillTooltip(
      "Passively generate your specialization's resource while equipped and recharged. Activate to reset eligible shatter and instrument cooldowns, restoring one ammunition charge where applicable. Continuum Split is excluded. The passive restarts after the signet recharges.",
      (balanceContext) => [
        profileFact(balanceContext, CORE.signetOfIllusions, 'pulseInterval', 'Passive interval', tooltipSeconds),
        profileFact(balanceContext, CORE.signetOfIllusions, 'resourceGain', 'Resources per passive pulse')
      ]
    ),
    [ID.SIGNET_OF_THE_ETHER]: skillTooltip(
      "Reset phantasm skill cooldowns. Its healing has no effect on the simulator's fixed player health."
    ),
    [ID.SIGNET_OF_DOMINATION]: skillTooltip(
      'Passively gain condition damage while the signet is available. Activate to stun your target.',
      (balanceContext) => [
        profileFact(balanceContext, CORE.signetOfDomination, 'conditionDamageBonus', 'Passive condition damage')
      ]
    ),
    [ID.SIGNET_OF_MIDNIGHT]: skillTooltip(
      'Passively gain expertise while the signet is available. Activate to blind nearby enemies.',
      (balanceContext) => [profileFact(balanceContext, CORE.signetOfMidnight, 'expertiseBonus', 'Passive expertise')]
    ),
    [ID.MIMIC]: skillTooltip(
      "Arm a window for your next completed utility skill. If its cast begins within the window, clear that skill's cooldown and cast lockout. Follow-up skills do not consume Mimic; ammunition charges are not replenished.",
      (balanceContext) => [
        profileFact(balanceContext, CORE.mimic, 'durationMultiplier', 'Mimic window', tooltipSeconds)
      ]
    ),
    [ID.MIND_THE_GAP]: skillTooltip(
      'Strike, generate a resource, and gain Clarity for a subsequent spear skill.',
      (balanceContext) => [
        profileFact(balanceContext, CORE.clarity, 'durationMultiplier', 'Clarity window', tooltipSeconds)
      ]
    ),
    [ID.IMAGINARY_INVERSION]: skillTooltip(
      "Strike your target and consume Clarity if present. Healing and incoming-damage avoidance do not change the simulated player's health."
    ),
    [ID.ETHER_CLONE]: skillTooltip(
      'Strike and generate a clone. If already at the clone limit when the resource packet lands, inflict the additional condition instead. Other specializations generate their own resource.',
      (_c, entity) =>
        simulationEffectFacts((entity as MesmerSkill).maxCloneEffects, 'instead of creating a clone at the clone limit')
          .facts
    ),
    [ID.FLYING_CUTTER]: skillTooltip(
      'Strike your target. Repeated qualifying hits within the tracking window trigger an additional Cutter Burst.',
      (_c, entity) => {
        const tracked = (entity as MesmerSkill).trackedHitDamage!;
        return [
          ...simulationEffectFacts([{ ...tracked, type: 'strike' }], 'additional Cutter Burst').facts,
          { name: 'Hits required', detail: tooltipDecimal(tracked.hitsRequired) },
          { name: 'Hit tracking window', detail: tooltipSeconds(tracked.duration) }
        ];
      }
    ),
    [ID.VIRTUOSO_TROUBADOUR_AXES_OF_SYMMETRY]: skillTooltip(
      'Strike and confuse your target. Add further player-owned confusion for each clone present when this cast begins.'
    ),
    [ID.BLADE_RENEWAL]: skillTooltip(
      'Fill your stocked blades. The defensive animation does not model incoming damage.'
    ),
    [ID.ABSTRACTION]: skillTooltip(
      "Detonate the active Inspiring Imagery for its attack and a blast finisher in that image's ethereal field. The detonation prevents the image's natural boon explosion."
    ),
    ...Object.fromEntries(
      [ID.FALSE_OASIS, ID.CRYSTAL_SANDS].map((id) => [
        id,
        skillTooltip(
          "Create a Mirage Mirror after this skill's mirror delay. Pick up the mirror before it expires to strike, weaken the target, and gain Mirage Cloak.",
          (balanceContext, entity) => [
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, MIRAGE.mechanics).effects?.filter((effect) => effect.type === 'buff'),
              'mirror pickup window'
            ).facts,
            ...((entity as MesmerSkill).mesmerTasks || [])
              .filter((trigger) => trigger.type === 'mesmer.mirage.create-mirror')
              .map((trigger) => ({
                name: 'Mirror creation',
                detail: `${trigger.count ?? 1} mirror${(trigger.count ?? 1) === 1 ? '' : 's'}${trigger.atMs == null ? '' : ` after ${tooltipSeconds(trigger.atMs / 1000)}`}`
              }))
          ]
        )
      ])
    ),
    ...Object.fromEntries(
      [ID.SAND_THROUGH_GLASS, ID.ILLUSIONARY_AMBUSH, ID.DODGE_MIRAGE_CLOAK].map((id) => [
        id,
        skillTooltip(
          "Gain Mirage Cloak and open the ambush window. Cloak traits can grant boons and trigger existing clones' ambushes; Deceptive Evasion creates a clone when dodging.",
          cloakFacts
        )
      ])
    ),
    [ID.PICK_UP_MIRAGE_MIRROR]: (balanceContext) => ({
      description:
        'Consume an available, unexpired Mirage Mirror to strike, weaken your target, and gain Mirage Cloak. Picking up a mirror opens the ambush window and triggers cloak traits.',
      facts: [
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, MIRAGE.mechanics).effects?.filter((effect) => effect.type !== 'buff')
        ).facts,
        ...cloakFacts(balanceContext)
      ]
    }),
    [ID.DODGE_TROUBADOUR]: skillTooltip('Spend 50 endurance to evade. Mayhem reduces Flustering Flute recharge.'),
    ...Object.fromEntries(
      [
        [ID.TALE_OF_THE_HONORABLE_ROGUE, TROUBADOUR.honorableRogue, 'Drum'],
        [ID.TALE_OF_THE_SOULKEEPER, TROUBADOUR.soulkeeper, 'Lute'],
        [ID.TALE_OF_THE_VALIANT_MARSHAL, TROUBADOUR.valiantMarshal, 'Harp']
      ].map(([id, profileId, instrument]) => [
        id,
        skillTooltip(
          `Tell a tale and grant its boons to your party. If ${instrument} is active when the cast begins, gain notes. Raconteur adds protection.` +
            (id === ID.TALE_OF_THE_HONORABLE_ROGUE ? ' Restore 50 endurance.' : ''),
          (balanceContext) => [
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, profileId).effects?.map((effect) => ({
                ...effect,
                audience: { recipients: 'party', maximumRecipients: 5 }
              }))
            ).facts,
            profileFact(balanceContext, profileId, 'resourceGain', 'Notes with matching instrument')
          ]
        )
      ])
    ),
    [ID.TALE_OF_THE_TORTURED_MASTERMIND]: skillTooltip(
      'Tell a tale and strike your target. Gain a note if Flute was active when the cast began. Raconteur also grants party protection.'
    ),
    ...Object.fromEntries(
      [ID.TALE_OF_THE_SECOND_SCION, ID.TALE_OF_THE_AUGUST_QUEEN].map((id) => [
        id,
        skillTooltip(
          'Tell a tale. Raconteur grants party protection. This tale has no additional instrument-note branch in the simulation.'
        )
      ])
    )
  },
  traits: {
    [TRAIT.ILLUSION_OF_VULNERABILITY]: outsideScopeTooltip,
    [TRAIT.DAZZLING]: traitTooltip('Landed control effects from you or your summons inflict vulnerability.'),
    [TRAIT.FRAGILITY]: traitTooltip(
      'Your strikes deal increased damage for each vulnerability stack on the target.',
      (balanceContext) => [
        modifierFact(balanceContext, 'mesmer.fragility', 'damagePerStack', 'Strike damage per vulnerability stack')
      ]
    ),
    [TRAIT.BOUNTIFUL_BLADES]: traitTooltip(
      'Mirror Blade gains additional target hits. Phantasmal Berserker summons additional phantasms, each with reduced damage.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'summons', 'Phantasm count multiplier', (value) => `${tooltipDecimal(value)}×`),
        profileFact(balanceContext, id, 'damageMultiplier', 'Damage per phantasm', tooltipFactorChange)
      ],
      'additional Mirror Blade hits'
    ),
    [TRAIT.EMPOWERED_ILLUSIONS]: traitTooltip(
      'Clones and phantasms deal increased strike damage.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'mesmer.empowered-illusions',
          'factor',
          'Illusion strike damage',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.RENDING_SHATTER]: outsideScopeTooltip,
    [TRAIT.SHATTERED_CONCENTRATION]: outsideScopeTooltip,
    [TRAIT.EGOTISM]: traitTooltip(
      'Your strikes deal increased damage after the target has lost health. Your own health remains full in combat.',
      (balanceContext) => [
        modifierFact(balanceContext, 'mesmer.egotism', 'factor', 'Strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.FURIOUS_INTERRUPTION]: outsideScopeTooltip,
    [TRAIT.VICIOUS_EXPRESSION]: traitTooltip(
      'Deal increased strike damage against the boonless simulated target, including illusion strikes.',
      (balanceContext) => [
        modifierFact(balanceContext, 'mesmer.vicious-expression', 'factor', 'Strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.MENTAL_ANGUISH]: traitTooltip(
      'Eligible first-strike shatter packets deal increased damage, with a larger bonus while the target is not activating skills.',
      (balanceContext) => [
        modifierFact(
          balanceContext,
          'mesmer.mental-anguish',
          'activatingFactor',
          'Damage while target activates skills',
          tooltipFactorChange
        ),
        modifierFact(
          balanceContext,
          'mesmer.mental-anguish',
          'idleFactor',
          'Damage while target is idle',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.POWER_BLOCK]: outsideScopeTooltip,
    [TRAIT.CRITICAL_INFUSION]: outsideScopeTooltip,
    [TRAIT.SHARPER_IMAGES]: traitTooltip('Critical strikes from clones and phantasms inflict bleeding.'),
    [TRAIT.MASTER_FENCER]: traitTooltip(
      'Your eligible critical hits grant fury to yourself and nearby allies, with different durations.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.PHANTASMAL_FURY]: traitTooltip(
      'Phantasms gain critical-strike chance. Virtuoso grants an additional phantasm critical-chance bonus.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          TRAIT.PHANTASMAL_FURY,
          'criticalChance',
          'Phantasm critical chance',
          tooltipPercent
        ),
        profileFact(
          balanceContext,
          TRAIT.QUIET_INTENSITY,
          'phantasmCriticalChance',
          'Additional phantasm critical chance as Virtuoso',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.MENTAL_GYMNASTICS]: outsideScopeTooltip,
    [TRAIT.DUELISTS_DISCIPLINE]: outsideScopeTooltip,
    [TRAIT.BLINDING_DISSIPATION]: traitTooltip(
      'Eligible shatter hits blind the target. Blindness can trigger Ineptitude.'
    ),
    [TRAIT.WANDERING_MIND]: outsideScopeTooltip,
    [TRAIT.FENCERS_FINESSE]: traitTooltip(
      'Sword hits grant stacking ferocity. Sword skills recharge faster.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributePerStack', 'Ferocity per stack'),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum stacks'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Stack duration', tooltipSeconds),
        profileFact(balanceContext, id, 'rechargeMultiplier', 'Sword recharge', tooltipFactorChange)
      ]
    ),
    [TRAIT.SUPERIORITY_COMPLEX]: traitTooltip(
      'Your critical strikes deal increased damage. Use the larger bonus against low-health or eligible controlled targets; defiance alone does not activate it.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          TRAIT.SUPERIORITY_COMPLEX,
          'highHealthFactor',
          'Base critical damage',
          tooltipFactorChange
        ),
        profileFact(
          balanceContext,
          TRAIT.SUPERIORITY_COMPLEX,
          'lowHealthOrDisabledFactor',
          'Enhanced critical damage',
          tooltipFactorChange
        ),
        profileFact(
          balanceContext,
          TRAIT.SUPERIORITY_COMPLEX,
          'threshold',
          'Target health threshold',
          (value) => `${tooltipDecimal(value * 100)}%`
        )
      ]
    ),
    [TRAIT.INEPTITUDE]: traitTooltip(
      'Blindness and qualifying interrupts inflict confusion. Only the interrupt trigger against a defiant target has an internal cooldown.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'internalCooldown', 'Defiant interrupt cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.DECEPTIVE_EVASION]: traitTooltip('Dodging as Mirage creates a clone.'),
    [TRAIT.METAPHYSICAL_REJUVENATION]: outsideScopeTooltip,
    [TRAIT.ILLUSIONARY_MEMBRANE]: traitTooltip(
      'Using your second shatter activates a temporary condition-damage bonus.',
      (balanceContext) => [modifierFact(balanceContext, 'mesmer.illusionary-membrane', 'amount', 'Condition damage')]
    ),
    [TRAIT.CHAOTIC_PERSISTENCE]: traitTooltip(
      'Gain expertise and concentration while regeneration is assumed active.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'expertiseBonus', 'Expertise'),
        profileFact(balanceContext, id, 'concentrationBonus', 'Concentration')
      ]
    ),
    [TRAIT.METHOD_OF_MADNESS]: traitTooltip(
      'Completing a healing skill triggers Lesser Chaos Storm, repeatedly striking the target.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds)]
    ),
    [TRAIT.ILLUSIONARY_DEFENSE]: outsideScopeTooltip,
    [TRAIT.MASTER_OF_MANIPULATION]: outsideScopeTooltip,
    [TRAIT.AUSPICIOUS_ANGUISH]: outsideScopeTooltip,
    [TRAIT.CHAOTIC_TRANSFERENCE]: outsideScopeTooltip,
    [TRAIT.CHAOTIC_INTERRUPTION]: traitTooltip(
      "Interrupting a target that is activating a skill reduces the active weapon set's phantasm recharge. Repeated triggers against a defiant target are cooldown-limited.",
      // Use the same patchable recharge and proc interval as the interrupt handler.
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'recharge', 'Phantasm recharge reduction', tooltipSeconds),
        profileFact(balanceContext, id, 'internalCooldown', 'Internal cooldown against defiant targets', tooltipSeconds)
      ]
    ),
    [TRAIT.SHAPER_OF_CHAOS]: outsideScopeTooltip,
    [TRAIT.PRISMATIC_UNDERSTANDING]: outsideScopeTooltip,
    [TRAIT.BOUNTIFUL_DISILLUSIONMENT]: outsideScopeTooltip,
    [TRAIT.MENDERS_PURITY]: outsideScopeTooltip,
    [TRAIT.INSPIRING_DISTORTION]: outsideScopeTooltip,
    [TRAIT.ILLUSIONARY_INSPIRATION]: outsideScopeTooltip,
    [TRAIT.MEDICS_FEEDBACK]: outsideScopeTooltip,
    [TRAIT.RESTORATIVE_MANTRAS]: outsideScopeTooltip,
    [TRAIT.SYMPATHETIC_VISAGE]: outsideScopeTooltip,
    [TRAIT.WARDENS_FEEDBACK]: outsideScopeTooltip,
    [TRAIT.EGO_RESTORATION]: outsideScopeTooltip,
    [TRAIT.TEMPORAL_ENCHANTER]: outsideScopeTooltip,
    [TRAIT.MENTAL_DEFENSE]: outsideScopeTooltip,
    [TRAIT.RESTORATIVE_ILLUSIONS]: outsideScopeTooltip,
    [TRAIT.BLURRED_INSCRIPTIONS]: outsideScopeTooltip,
    [TRAIT.CRY_OF_PAIN]: traitTooltip(
      "Replace the supported confusion shatter's base confusion application with this stronger application.",
      () => [],
      'replacement per eligible shatter hit'
    ),
    [TRAIT.COMPOUNDING_POWER]: traitTooltip(
      'Creating illusion resources grants temporary stacks that increase your strike and condition damage. Illusion strikes do not inherit the personal strike bonus.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'mesmer.compounding-power', 'strikePerStack', 'Strike damage per stack'),
        modifierFact(balanceContext, 'mesmer.compounding-power', 'conditionPerStack', 'Condition damage per stack'),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum stacks'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Stack duration', tooltipSeconds)
      ]
    ),
    [TRAIT.MASTER_OF_MISDIRECTION]: traitTooltip(
      'Shatters and instrument skills recharge faster.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'rechargeMultiplier', 'Recharge', tooltipFactorChange)]
    ),
    [TRAIT.SHATTER_STORM]: traitTooltip('The first shatter gains ammunition.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'maximumStacks', 'Ammunition')
    ]),
    [TRAIT.PERSISTENCE_OF_MEMORY]: outsideScopeTooltip,
    [TRAIT.THE_PLEDGE]: traitTooltip(
      'Your own burning applications from The Prestige and Phantasmal Mage apply additional burning. Phantasm and trait-proc applications do not trigger this.'
    ),
    [TRAIT.ESCAPE_ARTIST]: outsideScopeTooltip,
    [TRAIT.PHANTASMAL_HASTE]: traitTooltip('Phantasms perform their attacks faster.', (balanceContext, id) => [
      profileFact(
        balanceContext,
        id,
        'quicknessCastMultiplier',
        'Phantasm action speed',
        (value) => `${tooltipDecimal(value)}×`
      )
    ]),
    [TRAIT.MAIM_THE_DISILLUSIONED]: traitTooltip(
      'Eligible first-strike shatter packets inflict torment.',
      () => [],
      'per eligible shatter hit'
    ),
    [TRAIT.PHANTASMAL_FORCE]: traitTooltip(
      'Phantasms deal increased strike damage for each active might stack.',
      (balanceContext) => [
        modifierFact(balanceContext, 'mesmer.phantasmal-force', 'damagePerMight', 'Phantasm strike damage per might')
      ]
    ),
    [TRAIT.MASTER_OF_FRAGMENTATION]: (balanceContext, entity) => ({
      description:
        "Improve native first-shatter critical chance, add cripple to supported second-shatter hits and weakness to Deafening Drum, extend supported defensive shatters, and improve Crescendo's scaling per active instrument.",
      facts: [
        profileFact(
          balanceContext,
          TRAIT.MASTER_OF_FRAGMENTATION,
          'criticalChance',
          'First-shatter critical chance',
          tooltipPercent
        ),
        profileFact(
          balanceContext,
          entity.id,
          'durationMultiplier',
          'Additional defensive-shatter duration',
          tooltipSeconds
        ),
        profileFact(
          balanceContext,
          entity.id,
          'damageIncreasePerStack',
          'Crescendo damage per active instrument',
          tooltipPercent
        ),
        ...(tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
          (effect, index) =>
            simulationEffectFacts([effect], index === 0 ? 'second-shatter hit' : 'Deafening Drum hit').facts
        )
      ]
    }),
    [TRAIT.MALICIOUS_SORCERY]: traitTooltip('Confusion lasts longer.', (balanceContext) => [
      profileFact(balanceContext, TRAIT.MALICIOUS_SORCERY, 'durationMultiplier', 'Confusion duration')
    ]),
    [TRAIT.TIME_SPLITTER]: traitTooltip(
      'Unlock Chronomancer, shield, wells, and its shatters. Continuum Split temporarily records cooldowns and illusion resources for restoration.'
    ),
    [TRAIT.FLOW_OF_TIME]: traitTooltip(
      'Gain critical-strike chance while alacrity is active, including for illusions.',
      (balanceContext) => [
        profileFact(
          balanceContext,
          TRAIT.FLOW_OF_TIME,
          'criticalChance',
          'Critical chance with alacrity',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.TIME_MARCHES_ON]: outsideScopeTooltip,
    [TRAIT.DELAYED_REACTIONS]: traitTooltip(
      'Control effects from other skills can activate Danger Time, in addition to Time Sink.'
    ),
    [TRAIT.TIME_CATCHES_UP]: traitTooltip(
      'Eligible shatter packets deal increased damage against chilled, crippled, immobilized, or slowed targets.',
      (balanceContext) => [
        modifierFact(balanceContext, 'mesmer.time-catches-up', 'factor', 'Shatter strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.ALLS_WELL_THAT_ENDS_WELL]: outsideScopeTooltip,
    [TRAIT.DANGER_TIME]: traitTooltip(
      'Time Sink control effects temporarily increase critical damage for you and your illusions. Delayed Reactions allows other control effects to activate the bonus.',
      (balanceContext, id) => [
        profileFact(balanceContext, TRAIT.DANGER_TIME, 'criticalDamage', 'Critical damage', tooltipPercent),
        profileFact(balanceContext, id, 'durationMultiplier', 'Bonus duration', tooltipSeconds)
      ]
    ),
    [TRAIT.ILLUSIONARY_REVERSION]: traitTooltip(
      'Shattering exactly the required number of clones restores a clone.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'threshold', 'Clones spent'),
        profileFact(balanceContext, id, 'resourceGain', 'Clones restored')
      ]
    ),
    [TRAIT.TIME_BOMB]: traitTooltip(
      'Completing Time Sink arms a delayed explosion. Your strike damage increases until it explodes; another bomb cannot be armed while the timer is active.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'durationMultiplier', 'Explosion delay / bonus duration', tooltipSeconds),
        modifierFact(balanceContext, 'mesmer.time-bomb', 'factor', 'Strike damage while armed', tooltipFactorChange)
      ]
    ),
    [TRAIT.STRETCHED_TIME]: traitTooltip(
      'Shattering grants alacrity to the party. Add duration for yourself and for each clone spent to the listed base duration.',
      (balanceContext, id) => [
        profileFact(
          balanceContext,
          id,
          'durationPerTier',
          'Additional duration per player / clone tier',
          tooltipSeconds
        )
      ],
      'base duration before tiers'
    ),
    [TRAIT.SEIZE_THE_MOMENT]: traitTooltip(
      'Shattering grants quickness to the party. Add duration for yourself and for each clone spent to the listed base duration.',
      (balanceContext, id) => [
        profileFact(
          balanceContext,
          id,
          'durationPerTier',
          'Additional duration per player / clone tier',
          tooltipSeconds
        )
      ],
      'base duration before tiers'
    ),
    [TRAIT.CHRONOPHANTASMA]: traitTooltip(
      'Phantasms attack again before becoming clones, with increased strike damage.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'damageMultiplier', 'Phantasm strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.MIRAGE_CLOAK]: traitTooltip(
      "Unlock Mirage, axe, deceptions, and Mirage Cloak. Dodging grants a temporary window for your weapon's ambush attack."
    ),
    [TRAIT.NOMADS_ENDURANCE]: traitTooltip(
      'Shattering grants vigor. While vigor is active, increase your strike and condition damage.',
      (balanceContext) => [
        modifierFact(balanceContext, 'mesmer.nomads-endurance', 'strikeBonus', 'Strike damage with vigor'),
        modifierFact(balanceContext, 'mesmer.nomads-endurance', 'conditionBonus', 'Condition damage with vigor')
      ]
    ),
    [TRAIT.SPEED_OF_SAND]: outsideScopeTooltip,
    [TRAIT.SELF_DECEPTION]: traitTooltip(
      'Completing a deception skill while you have a clone creates an additional clone.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Clones created')]
    ),
    [TRAIT.RENEWING_OASIS]: traitTooltip('Gaining Mirage Cloak grants regeneration.'),
    [TRAIT.RIDDLE_OF_SAND]: traitTooltip(
      'Your first ambush inflicts additional confusion. Shattering recharges this effect.'
    ),
    [TRAIT.DESERT_DISTORTION]: traitTooltip(
      'Distortion opens an ambush window and creates Mirage Mirrors according to the clones spent.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'resourceGain', 'Mirrors per clone spent')]
    ),
    [TRAIT.MIRAGE_MANTLE]: traitTooltip('Player ambush attacks grant alacrity to the party.', () => [], 'party'),
    [TRAIT.PHANTOM_PAIN]: traitTooltip(
      'Shattering grants damage stacks for yourself and each clone spent. Stacks increase personal strike damage and condition damage.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'mesmer.phantom-pain', 'strikePerStack', 'Strike damage per stack'),
        modifierFact(balanceContext, 'mesmer.phantom-pain', 'conditionPerStack', 'Condition damage per stack'),
        profileFact(balanceContext, id, 'maximumStacks', 'Maximum stacks'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Stack duration', tooltipSeconds)
      ]
    ),
    [TRAIT.INFINITE_HORIZON]: traitTooltip(
      "Mirage Cloak also enables your clones to perform their weapon's ambush attacks. Eligible clones created during the cloak window can also ambush."
    ),
    [TRAIT.ELUSIVE_MIND]: traitTooltip(
      'Mirage Cloak records condition removal. Incoming conditions and their defensive effects are outside combat simulation scope.'
    ),
    [TRAIT.DUNE_CLOAK]: traitTooltip(
      'Gaining Mirage Cloak reduces Mind Wrack and Cry of Frustration recharge. Shattering enough clones grants Mirage Cloak.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'rechargeReduction', 'Recharge removed', tooltipSeconds),
        profileFact(balanceContext, id, 'threshold', 'Clones required'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Granted Mirage Cloak duration', tooltipSeconds)
      ]
    ),
    [TRAIT.PSYCHIC_BLADES]: traitTooltip(
      'Unlock Virtuoso, dagger, psionics, blades, and bladesongs. Blade resources replace clones.'
    ),
    [TRAIT.DEADLY_BLADES]: traitTooltip(
      'Blade critical hits inflict vulnerability. Completing a bladesong temporarily increases personal strike and condition damage.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'mesmer.deadly-blades', 'strikeBonus', 'Strike damage'),
        modifierFact(balanceContext, 'mesmer.deadly-blades', 'conditionBonus', 'Condition damage'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Damage-bonus duration', tooltipSeconds)
      ]
    ),
    [TRAIT.QUIET_INTENSITY]: traitTooltip(
      'Gain ferocity from vitality and additional personal critical-strike chance while fury is active.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'vitalityConversion', 'Vitality converted to ferocity', tooltipPercent),
        profileFact(
          balanceContext,
          TRAIT.QUIET_INTENSITY,
          'criticalChance',
          'Additional critical chance with fury',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.BLADETURN_REFRAIN]: outsideScopeTooltip,
    [TRAIT.MENTAL_FOCUS]: traitTooltip(
      'Your strikes deal increased damage when the target is nearby.',
      (balanceContext) => [
        modifierFact(balanceContext, 'mesmer.mental-focus', 'factor', 'Nearby strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.JAGGED_MIND]: traitTooltip('Critical blade strikes inflict bleeding.'),
    [TRAIT.DUELISTS_REVERSAL]: outsideScopeTooltip,
    [TRAIT.PHANTASMAL_BLADES]: traitTooltip(
      "A phantasm's completed attack lifecycle fires an additional blade strike."
    ),
    [TRAIT.SHARPENING_SORROW]: traitTooltip('Gain expertise while fury is assumed active.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'expertiseBonus', 'Expertise')
    ]),
    [TRAIT.PSYCHIC_RIPOSTE]: outsideScopeTooltip,
    [TRAIT.INFINITE_FORGE]: traitTooltip(
      'Periodically stock a blade. Spending enough blades on a bladesong refunds blades. Blade attacks deal increased strike damage.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'pulseInterval', 'Blade generation interval', tooltipSeconds),
        profileFact(balanceContext, id, 'playerStacks', 'Blades per interval'),
        profileFact(balanceContext, id, 'threshold', 'Blades spent to trigger refund'),
        profileFact(balanceContext, id, 'resourceGain', 'Blades refunded'),
        modifierFact(balanceContext, 'mesmer.infinite-forge', 'factor', 'Blade strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.BLOODSONG]: traitTooltip(
      'Bleeding deals increased damage. Applying enough bleeding stacks stocks a blade.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'mesmer.bloodsong', 'factor', 'Bleeding damage', tooltipFactorChange),
        profileFact(balanceContext, id, 'threshold', 'Bleeding stacks to stock blades'),
        profileFact(balanceContext, id, 'resourceGain', 'Blades stocked')
      ]
    ),
    [TRAIT.WANDERING_MINSTREL]: traitTooltip(
      'Unlock Troubadour, tales, notes, and instruments. Instruments replace shatters and consume notes to extend their playing time.'
    ),
    [TRAIT.SYMPHONIC_RESONANCE]: traitTooltip(
      'Active instruments grant their corresponding passive bonuses. Lute increases personal damage; Flute increases endurance regeneration.',
      (balanceContext, id) => [
        modifierFact(balanceContext, 'mesmer.lute', 'amount', 'Personal strike and condition damage with Lute'),
        profileFact(
          balanceContext,
          id,
          'enduranceRegenerationMultiplier',
          'Endurance regeneration with Flute',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.HARMONIZE]: traitTooltip('Successfully summoning a phantasm grants a note.', (balanceContext, id) => [
      profileFact(balanceContext, id, 'resourceGain', 'Notes gained')
    ]),
    [TRAIT.MAYHEM]: traitTooltip(
      "Flustering Flute attacks apply torment. Dodging reduces Flustering Flute's active recharge.",
      (balanceContext, id) => [profileFact(balanceContext, id, 'rechargeReduction', 'Recharge removed', tooltipSeconds)]
    ),
    [TRAIT.RACONTEUR]: traitTooltip('Resolving a tale grants protection.'),
    [TRAIT.SYNCOPATE]: traitTooltip(
      'Control effects and Method of Madness trigger an immediate strike. Deafening Drum also emits a delayed strike and daze.',
      (balanceContext, id) => [profileFact(balanceContext, id, 'initialDelay', 'Drum wave delay', tooltipSeconds)]
    ),
    [TRAIT.SHREDDING]: traitTooltip(
      'Lively Lute gains an additional strike. While Lute is playing, gain additional personal strike and condition damage.',
      (balanceContext) => [
        modifierFact(balanceContext, 'mesmer.shredding', 'amount', 'Additional strike and condition damage with Lute')
      ],
      'additional Lute strike'
    ),
    [TRAIT.LIFE_OF_THE_PARTY]: traitTooltip(
      'Lively Lute grants quickness and might to the party. Crescendo grants its separate quickness, might, and fury applications.',
      () => [],
      'party'
    ),
    [TRAIT.LOVE_SONG]: outsideScopeTooltip,
    [TRAIT.FORTISSIMO]: traitTooltip(
      'Each active instrument increases eligible attributes. Crescendo subsequently generates notes at regular intervals.',
      (balanceContext, id) => [
        profileFact(
          balanceContext,
          id,
          'attributeConversion',
          'Attribute increase per active instrument',
          tooltipPercent
        ),
        profileFact(balanceContext, id, 'maximumStacks', 'Note-generation pulses'),
        profileFact(balanceContext, id, 'pulseInterval', 'Pulse interval', tooltipSeconds),
        profileFact(balanceContext, id, 'resourceGain', 'Notes per pulse')
      ]
    ),
    [TRAIT.CALL_AND_RESPONSE]: traitTooltip(
      'Spending exactly the required notes on an instrument causes an afterimage to repeat its attack after a delay.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'threshold', 'Notes required'),
        profileFact(balanceContext, id, 'initialDelay', 'Repeat delay', tooltipSeconds)
      ]
    ),
    [TRAIT.ALTERED_CHORD]: traitTooltip(
      'Spending notes on an instrument reduces Crescendo recharge. Crescendo grants a strike-damage bonus after Lute, applies confusion after Flute, or applies a control effect after Drum.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'rechargeReduction', 'Crescendo recharge removed', tooltipSeconds),
        modifierFact(balanceContext, 'mesmer.altered-chord', 'amount', 'Strike damage after Lute'),
        profileFact(balanceContext, id, 'durationMultiplier', 'Lute bonus duration', tooltipSeconds)
      ],
      'Crescendo after Flute'
    )
  }
};
