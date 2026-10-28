import {
  fromProfile,
  simulationEffectFacts,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { lifeForce } from '#gw2/professions/necromancer/app/tooltips/shared.js';
import { dhuumfireProjection } from '#gw2/professions/necromancer/core/traits/soul-reaping/procs.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { shadeDhuumfireParameters } from '#gw2/professions/necromancer/specializations/scourge/mechanics/shade-projection.js';

/** Describe soul reaping tooltips from the selected balance data. */
export const necromancerSoulReapingTooltips = {
  [TRAIT.GLUTTONY]: traitTooltip('Life force gains are increased.', [
    ['lifeForceGainMultiplier', 'Life-force gains', tooltipFactorChange]
  ]),
  [TRAIT.SINISTER_SHROUD]: traitTooltip('Shroud and shade skills recharge faster.', [
    ['rechargeMultiplier', 'Shroud and shade recharge reduction', (value) => tooltipPercent(1 - value)]
  ]),
  [TRAIT.SOUL_BATTERY]: traitTooltip('Increases maximum life force.', [
    ['lifeForceCapacityMultiplier', 'Maximum life-force capacity', tooltipFactorChange]
  ]),
  [TRAIT.UNYIELDING_BLAST]: traitTooltip(
    'The first hit of shroud skill 1 inflicts vulnerability.',
    undefined,
    'on shroud skill 1'
  ),
  [TRAIT.SOUL_MARKS]: traitTooltip('Mark skills generate additional life force.', [
    ['lifeForceGain', 'Life force per landed mark', lifeForce]
  ]),
  [TRAIT.SPEED_OF_SHADOWS]: traitTooltip('Entering shroud grants swiftness.'),
  [TRAIT.SOUL_BARBS]: traitTooltip('Entering or leaving shroud briefly increases strike and condition damage.', [
    fromProfile(TRAIT.SOUL_BARBS, 'damageIncrease', 'Strike and siphon damage', tooltipPercent),
    fromProfile(TRAIT.SOUL_BARBS, 'conditionDamageIncrease', 'Condition damage', tooltipPercent),
    ['duration', 'Damage bonus duration', tooltipSeconds]
  ]),
  [TRAIT.VITAL_PERSISTENCE]: traitTooltip('Gain vitality.', [['attributeBonuses.vitality', 'Vitality']]),
  [TRAIT.FEAR_OF_DEATH]: traitTooltip(
    'Landing fear from a non-summon source generates life force, subject to its internal cooldown.',
    [
      ['lifeForceGain', 'Life force gained', lifeForce],
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]
  ),
  [TRAIT.ETERNAL_LIFE]: traitTooltip(
    "Regenerate life force below the trait's threshold while outside shroud. Entering shroud grants protection.",
    [
      ['lifeForceGain', 'Life force regenerated per pulse outside shroud', lifeForce],
      ['pulseInterval', 'Life-force pulse interval', tooltipSeconds],
      ['threshold', 'Life-force threshold (below)', (value) => `${tooltipDecimal(value * 100)}%`]
    ]
  ),
  [TRAIT.DEATH_PERCEPTION]: traitTooltip(
    'Gain critical-strike chance. Critical strikes deal more damage while in shroud.',
    [
      ['criticalChance', 'Critical chance', tooltipPercent],
      ['criticalDamage', 'Critical damage while in shroud', tooltipFactorChange]
    ]
  ),
  // Compose owner-provided overrides with Core's same named Burning projection used by hit reactions.
  [TRAIT.DHUUMFIRE]: (context, _entity, specialization) => {
    const scourge = specialization === 'Scourge';
    const { effect, interval } = dhuumfireProjection(
      context,
      scourge ? shadeDhuumfireParameters(requireSkillFromContext(context, ID.MANIFEST_SAND_SHADE)) : undefined,
      specialization === 'Harbinger' ? context.catalog.skillsById.get(ID.TAINTED_BOLTS)?.dhuumfireDuration : undefined
    );
    const effects = simulationEffectFacts(effect ? [effect] : [], scourge ? 'on shade strikes' : 'on shroud skill 1');
    return {
      ...effects,
      description: scourge ? 'Shade strikes inflict burning.' : 'Shroud skill 1 inflicts burning.',
      facts: [...effects.facts, ...(scourge ? [{ name: 'Internal cooldown', detail: tooltipSeconds(interval) }] : [])]
    };
  }
} satisfies NonNullable<ProfessionTooltips['traits']>;
