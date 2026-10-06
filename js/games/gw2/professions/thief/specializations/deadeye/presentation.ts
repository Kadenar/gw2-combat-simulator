import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { DEADEYE_BALANCE_PROFILE_IDS } from '#gw2/professions/thief/specializations/deadeye/profiles.js';

import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type {
  SkillDamagePreviewPreparation,
  SkillDamageState
} from '#gw2/platform/profession-presentation/skill-damage.js';
import { thiefUiState } from '#gw2/professions/thief/core/presentation.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { DEADEYE_STOLEN_SKILL_IDS } from '#gw2/professions/thief/specializations/deadeye/mechanics/stolen-skills.js';
import type { ThiefUiContext } from '#gw2/professions/thief/types.js';

function deadeyeStolenSkillIds(context: ThiefUiContext = {}): SkillId[] {
  const paletteTraits = context.traits;
  const fireForEffectSelected =
    hasTrait(context.config || {}, TRAIT.FIRE_FOR_EFFECT) ||
    (paletteTraits != null &&
      typeof (paletteTraits as ReadonlySet<string | number>).has === 'function' &&
      hasTrait(paletteTraits, TRAIT.FIRE_FOR_EFFECT));
  // Runtime configuration and the live palette expose traits through different contracts; honor either source.
  return fireForEffectSelected ? [ID.STEAL_TIME] : [...DEADEYE_STOLEN_SKILL_IDS];
}

export const deadeyeUi = Object.freeze({
  /** Expose selected Malice as damage scaling independent of how it was generated. */
  skillDamageState(context: SkillDamagePreviewPreparation, _skill: Skill): SkillDamageState | null {
    // Direct evaluation supplies damage state without prerequisite actions.
    return {
      assumptions: [`Malice: ${Number(context.values.malice ?? 0)}`]
    };
  },
  /** Declare this module's conditional inputs without adding simulation settings. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    preview.add({
      key: 'malice',
      label: 'Malice',
      group: 'Mechanic',
      kind: 'special',
      scope: ['damage'],
      max: balanceProfileNumber(
        requireBalanceProfileFromContext(
          context,
          preview.has('Maleficent Seven') ? TRAIT.MALEFICENT_SEVEN : DEADEYE_BALANCE_PROFILE_IDS.resources
        ),
        'maximumStacks'
      ),
      description: 'Malice consumed by a malicious attack'
    });
    preview.boon('quickness', 'Be Quick or Be Killed');
    return preview.controls;
  },

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
  resourceViews: (context: ThiefUiContext) => {
    const state = thiefUiState(context);
    return [
      {
        id: 'malice',
        singular: 'malice',
        plural: 'malice',
        // Render the observed clock; before a result exists use the selected profile's trait capacity.
        maximum:
          state.malice?.maximum ??
          balanceProfileNumber(
            requireBalanceProfileFromContext(
              context,
              hasTrait(context, TRAIT.MALEFICENT_SEVEN) ? TRAIT.MALEFICENT_SEVEN : DEADEYE_BALANCE_PROFILE_IDS.resources
            ),
            'maximumStacks'
          ),
        value: state.malice?.value ?? 0,
        canStart: false,
        step: 1,
        displayMode: 'pips',
        pipStyle: 'thief-malice',
        shortLabel: 'Mal',
        statusLabel: 'Current'
      }
    ];
  }
});
