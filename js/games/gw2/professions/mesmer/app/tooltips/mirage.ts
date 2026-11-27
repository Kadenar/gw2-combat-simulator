import {
  fromProfile,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import type { DescribeSimulationTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import { ACTOR, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { balanceNumber, requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { mesmerSelectedAmbush } from '#gw2/professions/mesmer/specializations/mirage/mechanics/ambush.js';
import { MESMER_MIRAGE_AMBUSH_SKILLS } from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';

const cloakFacts = (balanceContext: Parameters<DescribeSimulationTooltip>[0]) => [
  profileFact(balanceContext, TRAIT.MIRAGE_CLOAK, 'duration', 'Mirage Cloak', tooltipSeconds),
  profileFact(balanceContext, TRAIT.MIRAGE_CLOAK, 'durationPerTier', 'Ambush window', tooltipSeconds)
];

/** Describe mirage tooltips from the selected balance data. */
export const mirageTooltips = {
  skills: {
    [ID.AXES_OF_SYMMETRY]: skillTooltip(
      'Strike and confuse your target. Each axe clone present when the cast begins performs its own additional strike and applies confusion.'
    ),
    ...Object.fromEntries(
      Object.entries(MESMER_MIRAGE_AMBUSH_SKILLS).map(([weapon, { id }]) => [
        id,
        (balanceContext, entity) => {
          const selected = balanceContext.catalog.skillsById.get(entity.id)!;
          // Describe repeated statuses with the same independent cadence used by the runtime.
          const { player } = mesmerSelectedAmbush(balanceContext.catalog, selected.id);
          const playerPackets = (player.ticks ?? player.statusAtMs)?.length ?? 1;
          // Each tab groups one attacker's applications and keeps boon recipients on their own rows.
          const factTabs = [false, true]
            .map((clone) => ({
              label: clone ? 'Each clone' : 'Your ambush',
              facts: simulationEffectFacts(
                (selected.effects || [])
                  .filter((effect) => (effect.source === 'Clone') === clone)
                  .map((effect) => {
                    if (effect.type === 'control') return effect;

                    const projected = effect.source === 'Player' || effect.name === CONDITION.VULNERABILITY;
                    const repeated = projected && (effect.type === 'boon' || effect.name === CONDITION.VULNERABILITY);
                    return {
                      ...effect,
                      actorType: clone ? ACTOR.SUMMON : ACTOR.PLAYER,
                      applications: (effect.applications ?? 1) * (repeated ? playerPackets : 1),
                      ...(effect.type === 'boon' && (clone || projected)
                        ? {
                            audience: {
                              recipients: clone || selected.id === ID.CHAOS_VORTEX ? RECIPIENT.PARTY : RECIPIENT.SELF,
                              ...(clone || selected.id === ID.CHAOS_VORTEX ? { maximumRecipients: 5 } : {})
                            }
                          }
                        : {})
                    };
                  }),
                '',
                { strikeName: clone ? 'Clone attack' : 'Player attack' }
              ).facts
            }))
            .filter((tab) => tab.facts.length);
          const ambush =
            selected.id === ID.IMAGINARY_AXES
              ? 'Throw axes that inflict torment. '
              : selected.id === ID.CHAOS_VORTEX
                ? 'Inflict bleeding, torment, and confusion on your target. Grant might and fury to your party. '
                : '';
          return {
            description:
              `${ambush}Gaining Mirage Cloak readies one ambush for you. With Infinite Horizon, it also triggers an ambush from each of your ${weapon.toLowerCase()} clones.` +
              (selected.id === ID.MIRAGE_THRUST ? ' Your ambush also creates a clone.' : ''),
            facts: [],
            factTabs
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
              requireSkill(balanceContext.catalog, ID.MIRAGE_MIRROR_DAMAGE).effects?.filter(
                (effect) => effect.type === 'buff'
              ),
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
          requireSkill(balanceContext.catalog, ID.MIRAGE_MIRROR_DAMAGE).effects?.filter(
            (effect) => effect.type !== 'buff'
          )
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
      'Using a shatter gives you one stack, plus one more per clone you shatter. Each stack increases your strike and condition damage.',
      [
        fromProfile(TRAIT.PHANTOM_PAIN, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
        fromProfile(
          TRAIT.PHANTOM_PAIN,
          'conditionDamageIncreasePerStack',
          'Condition damage per stack',
          tooltipPercent
        ),
        ['maximumStacks', 'Maximum stacks'],
        ['duration', 'Stack duration', tooltipSeconds]
      ]
    ),
    [TRAIT.INFINITE_HORIZON]: traitTooltip(
      "Mirage Cloak also enables your clones to perform their weapon's ambush attacks. Eligible clones created during the cloak window can also ambush."
    ),
    [TRAIT.ELUSIVE_MIND]: outsideScopeTooltip,
    // Show the selected patch's threshold and durations beside the action each value belongs to.
    [TRAIT.DUNE_CLOAK]: ({ catalog }, { id }) => {
      const clones = balanceNumber(catalog, id, 'threshold');
      const duration = tooltipSeconds(balanceNumber(catalog, id, 'duration'));
      const reduction = tooltipSeconds(balanceNumber(catalog, id, 'rechargeReduction'));
      return {
        description: `Shatter at least ${clones} ${clones === 1 ? 'clone' : 'clones'} at once to gain Mirage Cloak for ${duration}. Each time you gain Mirage Cloak, reduce the remaining recharge of Mind Wrack and Cry of Frustration by ${reduction}.`,
        facts: []
      };
    }
  }
} satisfies ProfessionTooltips;
