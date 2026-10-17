import { ACTOR, RECIPIENT } from '#gw2/platform/constants.js';
import {
  fromProfile,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  profileFact,
  tooltipPercent,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import {
  MIRAGE_BALANCE_PROFILE_IDS as MIRAGE,
  MIRAGE_AMBUSH_PROFILE_IDS,
  mesmerProfiledAmbush
} from '#gw2/professions/mesmer/specializations/mirage/profiles.js';
import { MESMER_MIRAGE_AMBUSH_SKILLS } from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { DescribeSimulationTooltip } from '#gw2/app/shared/simulation-tooltip.js';

const cloakFacts = (balanceContext: Parameters<DescribeSimulationTooltip>[0]) => [
  profileFact(balanceContext, MIRAGE.mechanics, 'durationMultiplier', 'Mirage Cloak', tooltipSeconds),
  profileFact(balanceContext, MIRAGE.mechanics, 'durationPerTier', 'Ambush window', tooltipSeconds)
];

/** Describe mirage tooltips from the selected balance data. */
export const mirageTooltips = {
  skills: {
    [ID.AXES_OF_SYMMETRY]: skillTooltip(
      'Strike and confuse your target. Each axe clone present when the cast begins performs its own additional strike and applies confusion.'
    ),
    ...Object.fromEntries(
      Object.keys(MIRAGE_AMBUSH_PROFILE_IDS)
        .map((weapon) => MESMER_MIRAGE_AMBUSH_SKILLS[weapon].id)
        .map((id) => [
          id,
          (balanceContext, entity) => {
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
                    actorType: clone ? ACTOR.SUMMON : ACTOR.PLAYER,
                    applications: (effect.applications ?? 1) * (repeated ? playerPackets : 1),
                    ...(effect.type === 'boon'
                      ? {
                          audience: {
                            recipients: clone || selected.id === ID.CHAOS_VORTEX ? RECIPIENT.PARTY : RECIPIENT.SELF,
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
          }
        ])
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
            ...((entity as MesmerSkill).tasks || [])
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
    })
  },
  traits: {
    [TRAIT.MIRAGE_CLOAK]: traitTooltip(
      "Unlock Mirage, axe, deceptions, and Mirage Cloak. Dodging grants a temporary window for your weapon's ambush attack."
    ),
    [TRAIT.NOMADS_ENDURANCE]: traitTooltip(
      'Shattering grants vigor. While vigor is active, increase your strike and condition damage.',
      [
        fromProfile(TRAIT.NOMADS_ENDURANCE, 'damageIncrease', 'Strike damage with vigor', tooltipPercent),
        fromProfile(TRAIT.NOMADS_ENDURANCE, 'conditionDamageIncrease', 'Condition damage with vigor', tooltipPercent)
      ]
    ),
    [TRAIT.SPEED_OF_SAND]: outsideScopeTooltip,
    [TRAIT.SELF_DECEPTION]: traitTooltip(
      'Completing a deception skill while you have a clone creates an additional clone.',
      [['resourceGain', 'Clones created']]
    ),
    [TRAIT.RENEWING_OASIS]: traitTooltip('Gaining Mirage Cloak grants regeneration.'),
    [TRAIT.RIDDLE_OF_SAND]: traitTooltip(
      'Your first ambush inflicts additional confusion. Shattering recharges this effect.'
    ),
    [TRAIT.DESERT_DISTORTION]: traitTooltip(
      'Distortion opens an ambush window and creates Mirage Mirrors according to the clones spent.',
      [['resourceGain', 'Mirrors per clone spent']]
    ),
    [TRAIT.MIRAGE_MANTLE]: traitTooltip(
      'Player ambush attacks grant alacrity to the party.',
      () => [],
      RECIPIENT.PARTY
    ),
    [TRAIT.PHANTOM_PAIN]: traitTooltip(
      'Shattering grants damage stacks for yourself and each clone spent. Stacks increase personal strike damage and condition damage.',
      [
        fromProfile(TRAIT.PHANTOM_PAIN, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
        fromProfile(
          TRAIT.PHANTOM_PAIN,
          'conditionDamageIncreasePerStack',
          'Condition damage per stack',
          tooltipPercent
        ),
        ['maximumStacks', 'Maximum stacks'],
        ['durationMultiplier', 'Stack duration', tooltipSeconds]
      ]
    ),
    [TRAIT.INFINITE_HORIZON]: traitTooltip(
      "Mirage Cloak also enables your clones to perform their weapon's ambush attacks. Eligible clones created during the cloak window can also ambush."
    ),
    [TRAIT.ELUSIVE_MIND]: outsideScopeTooltip,
    [TRAIT.DUNE_CLOAK]: traitTooltip(
      'Gaining Mirage Cloak reduces Mind Wrack and Cry of Frustration recharge. Shattering enough clones grants Mirage Cloak.',
      [
        ['rechargeReduction', 'Recharge removed', tooltipSeconds],
        ['threshold', 'Clones required'],
        ['durationMultiplier', 'Granted Mirage Cloak duration', tooltipSeconds]
      ]
    )
  }
} satisfies ProfessionTooltips;
