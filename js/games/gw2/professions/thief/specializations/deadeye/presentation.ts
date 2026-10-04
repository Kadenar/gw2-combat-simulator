import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { DEADEYE_BALANCE_PROFILE_IDS } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';
import type { RotationCommand } from '#gw2/platform/execution/types.js';

import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { DEADEYE_STOLEN_SKILL_IDS } from '#gw2/professions/thief/specializations/deadeye/mechanics/stolen-skills.js';
import { thiefUiState } from '#gw2/professions/thief/core/presentation.js';
import type { ThiefUiContext } from '#gw2/professions/thief/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type {
  SkillDamagePreviewPreparation,
  SkillDamageProbeSetup
} from '#gw2/platform/profession-presentation/skill-damage.js';

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
  /** A normal Mark makes stolen skills available without a preview-specific resource model. */
  skillDamageProbe(context: SkillDamagePreviewPreparation, skill: Skill): SkillDamageProbeSetup | null {
    // Earn malice on a marked target before a malicious attack; the engine owns crit gains, initiative and spending.
    if ((skill as ThiefSkill).malicious) {
      const builder = context.catalog.skills.find(
        (candidate) =>
          candidate.weapon === skill.weapon &&
          candidate.type === 'Weapon' &&
          Number(candidate.initiativeCost) > 0 &&
          !candidate.stealthAttack &&
          candidate.slot === 'Weapon_2'
      );
      const setup: RotationCommand[] = [{ type: 'cast', skillId: ID.DEADEYES_MARK }];
      if (builder)
        for (let i = 0; i < Number(context.values.maliceAttacks); i++)
          setup.push({ type: 'cast', skillId: builder.id, offTarget: false });
      setup.push({ type: 'cast', skillId: ID.BLINDING_POWDER });
      return { setup, skipPredecessors: true };
    }

    return DEADEYE_STOLEN_SKILL_IDS.includes(skill.id) || skill.id === ID.STEAL_TIME
      ? { setup: [{ type: 'cast', skillId: ID.DEADEYES_MARK }] }
      : null;
  },
  /** Declare this module's conditional inputs without adding simulation settings. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    preview.add({
      key: 'maliceAttacks',
      label: 'Malice preparation attacks',
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
      description: 'Marked weapon attacks before stealth; actual malice gains depend on the selected build'
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
        // Default to 5 when state is not yet initialized; maximumMalice becomes 7 when Maleficent Seven is equipped
        maximum: state.maximumMalice || 5,
        value: state.malice || 0,
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
