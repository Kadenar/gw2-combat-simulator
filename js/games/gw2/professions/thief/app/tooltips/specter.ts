import { BOON, boonKey } from '#gw2/platform/effects/boons.js';
import {
  fromProfile,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  profileFact,
  tooltipPercent,
  tooltipDecimal,
  tooltipNumber,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips,
  type DescribeSimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { SPECTER_BALANCE_PROFILE_IDS as SPECTER } from '#gw2/professions/thief/specializations/specter/profiles.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { requireEffect } from '#gw2/platform/skills/balance-profiles.js';

const siphonTooltip: DescribeSimulationTooltip = skillTooltip(
  'Siphon the target, trigger stealing traits, and gain Shadow Force. Replaces the held stolen-skill pool without granting a stolen skill.',
  [
    fromProfile(SPECTER.resources, 'lifeForceGain', 'Shadow Force gained'),
    fromProfile(TRAIT.AMPLIFIED_SIPHONING, 'resourceGain', 'Additional Shadow Force with Amplified Siphoning')
  ]
);

const shadowShroudEnterTooltip: DescribeSimulationTooltip = (balanceContext) => {
  const profile = tooltipProfile(balanceContext, SPECTER.enterShadowShroud);
  return {
    description:
      'Enter Shadow Shroud and replace the skill bar. Shadow Force drains continuously; depletion exits shroud automatically. Grant barrier to the tethered ally, enabling supported barrier traits. Manual exit has a brief initial lockout.',
    facts: [
      profileFact(balanceContext, SPECTER.resources, 'maximumStacks', 'Maximum Shadow Force'),
      profileFact(
        balanceContext,
        SPECTER.resources,
        'lifeForceDrain',
        'Maximum Shadow Force drained per second',
        (value) => `${tooltipDecimal(value * 100)}%`
      ),
      ...simulationEffectFacts(
        profile.effects?.map((effect) => ({
          ...effect,
          audience: {
            recipients: 'party',
            affectsSelf: false,
            maximumRecipients: tooltipNumber(profile, 'maximumTargets')
          }
        }))
      ).facts
    ]
  };
};

const shadowShroudExitTooltip: DescribeSimulationTooltip = skillTooltip(
  'Leave Shadow Shroud, stop its Shadow Force drain, and restore the weapon bar. Supported shroud-exit and swap effects apply.'
);

const shadowShroudSkillTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const facts = [...simulationEffectFacts(balanceContext.catalog.skillsById.get(entity.id)!.effects).facts];
  // Tooltips retain the same skill-to-boon identity as execution after a packet is removed.
  const boonName =
    entity.id === ID.GRASPING_SHADOWS
      ? boonKey(BOON.ALACRITY)
      : entity.id === ID.DAWNS_REPOSE
        ? boonKey(BOON.PROTECTION)
        : entity.id === ID.MIND_SHOCK
          ? boonKey(BOON.AEGIS)
          : null;

  if (boonName) {
    const profile = tooltipProfile(balanceContext, TRAIT.SHADESTEP);
    const boon = requireEffect(profile, 'boon', boonName);

    if (boon) facts.push(...simulationEffectFacts([boon], 'party; requires Shadestep and a completed cast').facts);
  }

  if (entity.id === ID.DAWNS_REPOSE) {
    // Unlike entering shroud, Dawn's Repose also grants barrier to the caster.
    const profile = tooltipProfile(balanceContext, SPECTER.dawnsReposeBarrier);
    facts.push(
      ...simulationEffectFacts(
        profile.effects?.map((effect) => ({
          ...effect,
          audience: {
            recipients: 'party',
            affectsSelf: true,
            maximumRecipients: tooltipNumber(profile, 'maximumTargets')
          }
        }))
      ).facts
    );
  }

  return {
    description:
      'Use this skill while in Shadow Shroud. Qualifying completed casts also apply their Shadestep boon; interrupted casts do not receive that completion bonus.',
    facts
  };
};

/** Describe specter tooltips from the selected balance data. */
export const specterTooltips = {
  skills: {
    [ID.SIPHON]: siphonTooltip,
    [ID.ENTER_SHADOW_SHROUD]: shadowShroudEnterTooltip,
    [ID.EXIT_SHADOW_SHROUD]: shadowShroudExitTooltip,
    ...Object.fromEntries(
      [ID.ETERNAL_NIGHT, ID.GRASPING_SHADOWS, ID.DAWNS_REPOSE, ID.MIND_SHOCK, ID.HAUNT_SHOT].map((id) => [
        id,
        shadowShroudSkillTooltip
      ])
    )
  },
  traits: {
    [TRAIT.SPECTER]: traitTooltip(
      'Unlock Specter, scepter, wells, Siphon, and Shadow Shroud. Siphon and initiative spending generate shadow force.'
    ),
    [TRAIT.DARK_SENTRY]: traitTooltip(
      "Barrier grants from Enter Shadow Shroud and Dawn's Repose give eligible allies Rot Wallow Venom. Their next strike within the venom window inflicts torment.",
      [['internalCooldown', 'Cooldown per ally', tooltipSeconds]],
      'allied venom'
    ),
    [TRAIT.PANAKUS_AMBITION]: outsideScopeTooltip,
    [TRAIT.SECOND_OPINION]: traitTooltip(
      'Gain condition damage, with an additional bonus while wielding a scepter. Gain healing power from condition damage.',
      [
        ['attributeBonus', 'Condition damage'],
        ['attributePerStack', 'Additional condition damage with scepter'],
        ['attributeConversion', 'Condition damage converted to healing power', tooltipPercent]
      ]
    ),
    [TRAIT.SHALLOW_GRAVE]: outsideScopeTooltip,
    [TRAIT.CONSUME_SHADOWS]: outsideScopeTooltip,
    [TRAIT.LARCENOUS_TORMENT]: traitTooltip(
      'Each stack of torment you apply siphons life and generates shadow force while outside Shadow Shroud. Life siphons bypass armor and cannot critically strike.',
      [['resourceGain', 'Shadow force per torment stack']],
      'per torment stack'
    ),
    [TRAIT.AMPLIFIED_SIPHONING]: traitTooltip('Increase the shadow force generated by Siphon.', [
      ['resourceGain', 'Additional Shadow Force from Siphon']
    ]),
    [TRAIT.TRAVERSING_DUSK]: outsideScopeTooltip,
    [TRAIT.STRENGTH_OF_SHADOWS]: traitTooltip('Gain expertise from vitality. Torment deals more damage.', [
      ['attributeConversion', 'Vitality converted to expertise', tooltipPercent],
      fromProfile(TRAIT.STRENGTH_OF_SHADOWS, 'conditionDamageIncrease', 'Torment damage', tooltipPercent)
    ]),
    [TRAIT.HUNGERING_DARKNESS]: outsideScopeTooltip,
    [TRAIT.SHADESTEP]: (balanceContext, entity) => ({
      description: 'Completing a supported Shadow Shroud skill grants its corresponding boon to the party.',
      // Match runtime boon identities so removing or reordering effects cannot move skill labels.
      facts: [
        [boonKey(BOON.ALACRITY), 'Grasping Shadows · party'],
        [boonKey(BOON.PROTECTION), "Dawn's Repose · party"],
        [boonKey(BOON.AEGIS), 'Mind Shock · party']
      ].flatMap(([name, label]) => {
        const effect = requireEffect(tooltipProfile(balanceContext, entity.id), 'boon', name);
        return effect ? simulationEffectFacts([effect], label).facts : [];
      })
    })
  }
} satisfies ProfessionTooltips;
