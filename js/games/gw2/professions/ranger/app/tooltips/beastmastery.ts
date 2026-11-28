import {
  fromProfile,
  internalCooldownFact,
  outsideScopeTooltip,
  profileFact,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { balanceNumber, effectNumber, requireEffect, requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

/** Describes Beastmastery from its active balance profiles without owning simulation behavior. */
export const rangerBeastmasteryTooltips = {
  // Pet skill recharge applies only to the pet, alongside its own attribute bonuses.
  [TRAIT.PACK_ALPHA]: (context, trait) => ({
    description: 'Your pet gains attributes and its skills recharge faster. In Beastmode, you gain attributes.',
    facts: [],
    factTabs: [
      ['Pet', 'conditionalAttributeBonuses'],
      ['Player in Beastmode', 'attributeBonuses']
    ].map(([label, pool]) => ({
      label,
      facts: [
        ...[
          ['power', 'Power'],
          ['precision', 'Precision'],
          ['toughness', 'Toughness'],
          ['vitality', 'Vitality'],
          ['conditionDamage', 'Condition damage']
        ].map(([key, name]) => profileFact(context, trait.id, `${pool}.${key}`, name)),
        ...(pool === 'conditionalAttributeBonuses'
          ? [profileFact(context, trait.id, 'rechargeMultiplier', 'Pet skill recharge', tooltipFactorChange)]
          : [])
      ]
    }))
  }),
  [TRAIT.LOUD_WHISTLE]: traitTooltip(
    'Your pet deals increased strike damage. Beastmode grants a separate personal strike-damage bonus.',
    [
      fromProfile(TRAIT.LOUD_WHISTLE, 'damageMultiplier', 'Pet strike damage', tooltipFactorChange),
      fromProfile(
        TRAIT.LOUD_WHISTLE,
        'playerDamageMultiplier',
        'Player strike damage in Beastmode',
        tooltipFactorChange
      )
    ]
  ),
  [TRAIT.PETS_PROWESS]: traitTooltip('Your pet gains ferocity. The bonus also applies to you in Beastmode.', [
    ['attributeBonuses.ferocity', 'Ferocity']
  ]),
  [TRAIT.GO_FOR_THE_EYES]: traitTooltip('The first hit of your merged Beast Ability blinds the target.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.NATURAL_HEALING]: outsideScopeTooltip,
  [TRAIT.RESOUNDING_TIMBRE]: traitTooltip(
    'Completing a command copies your current boons to the active pet. In Beastmode, commands extend your boons instead.',
    (context) => [
      // Show the PvE copy limit alongside the merged duration so both command outcomes are explained.
      { name: 'Maximum Boon Stacks Copied', detail: '25' },
      {
        name: 'Beastmode boon extension',
        detail: tooltipSeconds(balanceNumber(context.catalog, TRAIT.RESOUNDING_TIMBRE, 'duration'))
      }
    ]
  ),
  [TRAIT.WILTING_STRIKE]: traitTooltip('The first hit of your merged Beast Ability weakens the target.'),
  [TRAIT.BESTIAL_RAGE]: traitTooltip('Control effects while playing Soulbeast grant might and fury.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.HONED_AXES]: traitTooltip(
    'You and your pet gain ferocity. Wielding an axe increases your bonus. Axe skills recharge faster.',
    [
      ['attributeBonuses.ferocity', 'Base ferocity'],
      ['conditionalAttributeBonuses.ferocity', 'Ferocity while wielding an axe'],
      ['rechargeMultiplier', 'Axe recharge', tooltipFactorChange]
    ]
  ),
  [TRAIT.BEASTLY_WARDEN]: traitTooltip('Ursine and porcine pets deal increased strike damage.', [
    ['damageMultiplier', 'Pet strike damage', tooltipFactorChange]
  ]),
  [TRAIT.ZEPHYRS_SPEED]: outsideScopeTooltip,
  [TRAIT.GO_FOR_THE_THROAT]: (context) => {
    const skill = requireSkill(context.catalog, ID.LESSER_SIC_EM);
    // Both recipients share the command's recharge. Each buff supplies its own bonus and duration.
    return {
      description: `A beast skill hit casts ${skill.name} on your pet, or on you in Beastmode.`,
      facts: [internalCooldownFact(`${skill.name} recharge`, skill.cooldown ?? 0)],
      factSections: [
        ['Pet', 'lesser-sic-em-pet'],
        ['Player in Beastmode', 'lesser-sic-em']
      ].flatMap(([label, key]) => {
        const effect = requireEffect(skill, 'buff', key);

        if (!effect) return [];

        const bonus = tooltipPercent(effectNumber(skill, effect, 'damageIncreasePerStack'));
        const duration = tooltipSeconds(effectNumber(skill, effect, 'duration'));
        return [{ label, facts: [{ name: 'Strike damage', detail: `${bonus} for ${duration}`, icon: skill.icon }] }];
      })
    };
  }
} satisfies NonNullable<ProfessionTooltips['traits']>;
