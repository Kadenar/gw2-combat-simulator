import { RECIPIENT } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import {
  fromProfile,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  skillFact,
  tooltipDecimal,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { PARAGON_BALANCE_PROFILE_IDS as PARAGON } from '#gw2/professions/warrior/specializations/paragon/profiles.js';

/** Commands describe their selected echo action; shared cadence remains command policy. */
const commandTooltip: DescribeSimulationTooltip = (balanceContext, entity) =>
  skillTooltip(
    "Apply this command's initial effects and queue an echo. A completed burst triggers pending echoes early. Reverberation adds another echo. " +
      (entity.id === ID.FIND_THEIR_WEAKNESS
        ? 'The echo grants party might and adrenaline.'
        : entity.id === ID.ON_YOUR_KNEES
          ? 'The echo strikes and immobilizes your target.'
          : entity.id === ID.WE_SHALL_RETURN
            ? 'The echo grants adrenaline; revival is outside simulation scope.'
            : 'The defensive echo has no direct damage in the simulator.'),
    (context) => {
      const selected = requireSkillFromContext(context, entity.id);
      const echo = requireSkillAction(selected, 'echo');
      return [
        profileFact(context, PARAGON.commands, 'pulseInterval', 'Delay before echo', tooltipSeconds),
        ...simulationEffectFacts(
          echo.effects.map((effect) =>
            effect.type === 'boon' ? { ...effect, audience: { recipients: RECIPIENT.PARTY } } : effect
          ),
          'on echo'
        ).facts,
        skillFact(context, entity.id, 'echoResourceGain', 'Adrenaline gained on echo')
      ];
    }
  )(balanceContext, entity);

const chantTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const action = entity.id === ID.CHANT_OF_ACTION;
  const recovery = entity.id === ID.CHANT_OF_RECUPERATION;
  // Activation and refrain payloads remain on the chant action, including selected removals and edits.
  const selected = requireSkillFromContext(balanceContext, entity.id);
  const effects = requireSkillAction(selected, 'chant').effects.map((effect) => ({
    ...effect,
    audience: { recipients: RECIPIENT.PARTY }
  }));
  const opening = effects.filter((effect) => effect.name?.startsWith('Entry '));
  const refrain = effects.filter((effect) => effect.name?.startsWith('Refrain '));
  return {
    description:
      'Spend adrenaline, gain Motivation, and replace the active refrain. The refrain pulses until Motivation runs out; each pulse uses the Motivation tier before spending its cost. ' +
      (action
        ? 'Action pulses might, adding Fury at higher tiers. Enduring Refrain increases its might.'
        : recovery
          ? 'Recuperation has defensive effects, adding regeneration at the highest tier. Healing is outside combat simulation scope.'
          : 'Freedom pulses swiftness, adds resolution at higher tiers, and adds protection at the highest tier.'),
    facts: [
      ...simulationEffectFacts(opening, 'on activation').facts,
      ...simulationEffectFacts(refrain, 'on eligible refrain tier (Might per tier)').facts,
      skillFact(balanceContext, entity.id, 'resourceGain', 'Base Motivation gained'),
      profileFact(balanceContext, TRAIT.RALLY_THE_VALIANT, 'pulseInterval', 'Refrain pulse interval', tooltipSeconds),
      profileFact(balanceContext, TRAIT.RALLY_THE_VALIANT, 'minimumStacks', 'Motivation required for tier two'),
      profileFact(balanceContext, TRAIT.RALLY_THE_VALIANT, 'threshold', 'Motivation required for tier three')
    ]
  };
};

/** Describe paragon tooltips from the selected balance data. */
export const paragonTooltips = {
  skills: {
    // Descriptions bind to canonical skill identities, independently of execution owners.
    [ID.WE_WILL_NEVER_YIELD]: commandTooltip,
    [ID.WE_SHALL_RETURN]: commandTooltip,
    [ID.FIND_THEIR_WEAKNESS]: commandTooltip,
    [ID.ON_YOUR_KNEES]: commandTooltip,
    [ID.CHANT_OF_RECUPERATION]: chantTooltip,
    [ID.CHANT_OF_FREEDOM]: chantTooltip,
    [ID.CHANT_OF_ACTION]: chantTooltip
  },
  traits: {
    [TRAIT.RALLY_THE_VALIANT]: traitTooltip('Starting a non-chant burst while a refrain is active grants motivation.', [
      ['resourceGain', 'Motivation gained']
    ]),
    [TRAIT.INSPIRING_IMPLEMENTS]: traitTooltip(
      'Gain concentration. Weapon swapping grants adrenaline and motivation.',
      [
        ['attributeBonus', 'Concentration'],
        ['resourceGain', 'Adrenaline gained'],
        ['minimumStacks', 'Motivation gained'],
        ['internalCooldown', 'Swap-reward cooldown', tooltipSeconds]
      ]
    ),
    [TRAIT.UNYIELDING_RESOLVE]: outsideScopeTooltip,
    [TRAIT.CALL_TO_ACTION]: traitTooltip(
      'Entering combat grants motivation and starts Chant of Action if no refrain is active.',
      [['resourceGain', 'Motivation gained']]
    ),
    [TRAIT.CALMING_TONGUE]: outsideScopeTooltip,
    [TRAIT.LIBERATING_LIAISE]: outsideScopeTooltip,
    [TRAIT.STRENGTHENING_STANZAS]: traitTooltip('Deal increased damage while Chant of Action is the active refrain.', [
      fromProfile(TRAIT.STRENGTHENING_STANZAS, 'strikeBonus', 'Strike damage', tooltipPercent),
      fromProfile(TRAIT.STRENGTHENING_STANZAS, 'conditionBonus', 'Condition damage', tooltipPercent)
    ]),
    [TRAIT.INVIGORATING_TEMPO]: traitTooltip('Refrain pulses grant adrenaline for the motivation actually spent.', [
      ['resourceGain', 'Adrenaline per motivation spent']
    ]),
    [TRAIT.REVERBERATION]: traitTooltip(
      'Commands queue additional echoes. Bursts consume pending echoes immediately.',
      [['maximumStacks', 'Echo count']]
    ),
    [TRAIT.FEVERISH_PULSE]: traitTooltip(
      'Activating a chant grants party alacrity and reduces the recharge of the other chants.',
      [['rechargeReduction', 'Other-chant recharge reduction', tooltipSeconds]]
    ),
    [TRAIT.BRISK_PACING]: traitTooltip(
      'Motivation increases strike and condition damage. Higher motivation tiers replace the lower-tier bonuses.',
      (balanceContext) => [
        profileFact(balanceContext, TRAIT.BRISK_PACING, 'middleThreshold', 'Middle-tier motivation', tooltipDecimal),
        profileFact(balanceContext, TRAIT.BRISK_PACING, 'highThreshold', 'High-tier motivation', tooltipDecimal),
        ...(['Low', 'Middle', 'High'] as const).flatMap((tier) => [
          profileFact(
            balanceContext,
            TRAIT.BRISK_PACING,
            `strike${tier}`,
            `${tier}-tier strike damage`,
            tooltipPercent
          ),
          profileFact(
            balanceContext,
            TRAIT.BRISK_PACING,
            `condition${tier}`,
            `${tier}-tier condition damage`,
            tooltipPercent
          )
        ])
      ]
    ),
    [TRAIT.ENDURING_REFRAIN]: traitTooltip(
      'Chants grant additional motivation. Chant of Action refrain pulses grant additional might according to the motivation tier.',
      [
        ['resourceGain', 'Additional motivation'],
        ['stackMultiplier', 'Refrain might multiplier', (value) => `${value}×`]
      ]
    )
  }
} satisfies ProfessionTooltips;
