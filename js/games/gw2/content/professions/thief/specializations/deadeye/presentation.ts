import { deadeyeCastAvailability } from '#gw2/content/professions/thief/specializations/deadeye/mechanics/availability.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { DEADEYE_STOLEN_SKILL_IDS } from '#gw2/content/professions/thief/specializations/deadeye/mechanics/malice.js';
import { deadeyeWeaponSkillMatchesSet } from '#gw2/content/professions/thief/specializations/deadeye/skills/weapons.js';
import { thiefUiState } from '#gw2/content/professions/thief/core/presentation.js';
import type { ThiefSkill, ThiefUiContext } from '#gw2/content/professions/thief/types.js';

function deadeyeStolenSkillIds(context: ThiefUiContext = {}): number[] {
  const paletteTraits = context.traits;
  const fireForEffectSelected =
    hasTrait(context.config || {}, TRAIT.FIRE_FOR_EFFECT) ||
    (paletteTraits != null &&
      typeof (paletteTraits as ReadonlySet<string | number>).has === 'function' &&
      hasTrait(paletteTraits as ReadonlySet<string | number>, TRAIT.FIRE_FOR_EFFECT));
  // Runtime configuration and the live palette expose traits through different contracts; honor either source.
  return fireForEffectSelected ? [ID.STEAL_TIME] : [...DEADEYE_STOLEN_SKILL_IDS];
}

export const deadeyeUi = Object.freeze({
  weaponSkillMatchesSet: deadeyeWeaponSkillMatchesSet,
  paletteGroups: (context: ThiefUiContext) => {
    const stolenSkillIds = deadeyeStolenSkillIds(context);
    // Keep every choice visible beside Mark; shared availability greys out skills that have not been stolen.
    return [
      {
        id: 'thief-profession',
        label: 'F',
        skillIds: [ID.DEADEYES_MARK],
        color: '#9a535c',
        resourceAnchor: true,
        stackId: 'deadeye-stolen-skills',
        className: 'deadeye-mark-skill'
      },
      {
        id: 'deadeye-stolen-skills',
        label: 'Stolen',
        skillIds: stolenSkillIds,
        color: '#9a535c',
        stackId: 'deadeye-stolen-skills',
        className: 'deadeye-stolen-skills-grid'
      }
    ];
  },
  skillBarGroups: (context: ThiefUiContext) => [
    {
      id: 'deadeye-stolen-skills',
      label: 'Deadeye Stolen Skills',
      skillIds: deadeyeStolenSkillIds(context),
      color: '#9a535c',
      className: 'deadeye-stolen-skills-grid'
    }
  ],
  resourceViews: (context: ThiefUiContext) => {
    const state = thiefUiState(context);
    return [
      {
        id: 'malice',
        singular: 'malice',
        plural: 'malice',
        // Default to 5 when state is not yet initialized; maximumMalice becomes 7 when Maleficent Seven is equipped
        maximum: Number(state.maximumMalice || 5),
        value: Number(state.malice || 0),
        canStart: false,
        step: 1,
        displayMode: 'pips',
        pipStyle: 'thief-malice',
        shortLabel: 'Mal',
        statusLabel: 'Current'
      }
    ];
  },
  paletteSkillAvailability: (context: ThiefUiContext, skill: ThiefSkill) => {
    const result = deadeyeCastAvailability(
      {
        state: { profession: thiefUiState(context) }
      },
      skill
    );
    return {
      available: result.ready,
      message: result.ready ? '' : result.reason
    };
  }
});
