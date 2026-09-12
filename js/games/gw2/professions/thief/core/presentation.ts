import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/simulation/randomness.js';
import { THIEF_CORE_ASSUMPTION_CONTROLS } from '#gw2/professions/thief/build/core-assumptions.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { spearChainStageForSkill } from '#gw2/professions/thief/core/mechanics/spear-chain.js';
import { thiefWeaponSkillMatchesSet } from '#gw2/professions/thief/core/mechanics/weapon-state.js';
import { THIEF_PREPARATIONS } from '#gw2/professions/thief/core/mechanics/preparations.js';
import { storedStolenSkillChoices, THIEF_STOLEN_SKILL_IDS } from '#gw2/professions/thief/core/mechanics/steal.js';
import type { PaletteSkillAvailability, RotationStateSnapshotItem } from '#gw2/platform/engine/profession/types.js';
import type { ThiefSimulationEvent, ThiefSkill, ThiefState, ThiefUiContext } from '#gw2/professions/thief/types.js';

export function thiefUiState(context: ThiefUiContext = {}): Partial<ThiefState> {
  return flattenProfessionState<Partial<ThiefState>>(context.state?.profession || context.professionState);
}

export function thiefStealPaletteGroups(professionSkillId = ID.STEAL) {
  // Keep the base stolen-skill pool beside Steal so choices stay discoverable before and after they are granted.
  return [
    {
      id: 'thief-profession',
      label: 'F',
      skillIds: [professionSkillId],
      color: '#9a535c',
      resourceAnchor: true,
      stackId: 'thief-stolen-skills',
      className: 'thief-steal-skill'
    },
    {
      id: 'thief-stolen-skills',
      label: 'Stolen',
      skillIds: [...THIEF_STOLEN_SKILL_IDS],
      color: '#9a535c',
      stackId: 'thief-stolen-skills',
      className: 'thief-stolen-skill-choices'
    }
  ];
}

function corePaletteSkillAvailability(context: ThiefUiContext = {}, skill: ThiefSkill): PaletteSkillAvailability {
  const state = thiefUiState(context);
  // Show a placed preparation's trigger and let the palette wait until its shared arming deadline.
  const trap = THIEF_PREPARATIONS.find(
    (candidate) => candidate.prepareId === skill.id || candidate.triggerId === skill.id
  );
  if (trap) {
    const prepared = state[trap.preparedField] === true;
    if (skill.id === trap.prepareId) {
      return { available: !prepared, message: prepared ? `Activate ${trap.name} before preparing it again` : '' };
    }

    if (!prepared) return { available: false, message: `Prepare ${trap.name} first` };
    const retryAt = Number(state[trap.armedAtField] || 0);
    return retryAt > Number(context.time || 0)
      ? { available: false, message: 'The preparation is still arming', retryAt }
      : { available: true, message: '' };
  }

  const stealthed =
    Number(state.stealthStartedAt || 0) <= Number(context.time || 0) &&
    Number(state.stealthUntil || 0) > Number(context.time || 0) &&
    Number(state.revealedUntil || 0) <= Number(context.time || 0);
  const bonusStealthAttack =
    Number(state.stealthAttackCharges || 0) > 0 &&
    Number(state.stealthAttackExpiresAt || 0) > Number(context.time || 0);
  const spearChainStage = spearChainStageForSkill(skill.id);
  const flipValue = state.availableFlips?.[String(skill.id)];
  const flipAvailable = flipValue === Number.POSITIVE_INFINITY || Number(flipValue || 0) > Number(context.time || 0);
  if (
    skill.slot === 'Profession_2' &&
    (THIEF_STOLEN_SKILL_IDS.includes(skill.id) || (skill.categories || []).includes('stolen skill')) &&
    !storedStolenSkillChoices(state as ThiefState).includes(skill.id)
  ) {
    // Stolen-skill palettes remain visible for selection, but only the currently granted choices are actionable.
    return {
      available: false,
      message: 'Steal this skill before using it'
    };
  }

  if (spearChainStage != null && Number(state.spearChainStage || 0) !== spearChainStage) {
    return {
      available: false,
      message: `Advance the spear chain to stage ${spearChainStage + 1}`
    };
  }

  if (skill.type === 'Weapon' && skill.flipParentId != null && !flipAvailable) {
    return {
      available: false,
      message: 'Use its opening weapon skill first'
    };
  }

  if (
    skill.type === 'Weapon' &&
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId &&
    Number(state.availableFlips?.[String(skill.flipSkillId)] || 0) > Number(context.time || 0)
  ) {
    return {
      available: false,
      message: 'Use or wait out the active follow-up skill'
    };
  }

  if (skill.stealthAttack) {
    const available = stealthed || bonusStealthAttack;
    return {
      available,
      message: available ? '' : 'Gain stealth first'
    };
  }

  // Shadow Shroud remains visible because stealth replacement applies only to the equipped weapon bar.
  if (
    (stealthed || bonusStealthAttack) &&
    !skill.shadowShroudSkill &&
    skill.type === 'Weapon' &&
    skill.slot === 'Weapon_1'
  ) {
    return {
      available: false,
      message: "The active weapon's stealth attack replaces skill 1"
    };
  }

  return { available: true, message: '' };
}

function thiefCoreEventLogRow(context: ThiefUiContext, event: ThiefSimulationEvent) {
  if (event?.type !== 'thief.state') return undefined;
  const state = event.state || {};
  const logState = context.eventLogState as Map<string, { at: number; value: number }> | undefined;
  // Show resource changes (including endurance) and suppress unchanged regeneration checkpoints.
  const resources = (['initiative', 'endurance'] as const).flatMap((key) => {
    const value = Number(state[key] || 0);
    const at = Number(state[key === 'initiative' ? 'initiativeUpdatedAt' : 'enduranceUpdatedAt'] ?? event.at);
    const previous = logState?.get(key);
    // Completion snapshots may carry resources from cast start; never report those as spending.
    if (previous && at < previous.at) return [];
    logState?.set(key, { at, value });
    const before = previous?.value ?? null;
    if (before !== null && value.toFixed(1) === before.toFixed(1)) return [];
    const label = key === 'initiative' ? 'Initiative' : 'Endurance';
    const change = before === null ? '' : ` (${value > before ? '+' : ''}${(value - before).toFixed(1)})`;
    return [`${label} ${value.toFixed(1)}${change}`];
  });
  const reason = String(event.reason || 'state');
  // These changes already have named BUFF rows; their snapshots only synchronize engine state.
  if (
    !resources.length &&
    ['resources', 'lead-attacks', 'daredevil-dodge', 'spider-venom', 'skale-venom', 'devourer-venom'].includes(reason)
  )
    return null;
  const label = reason
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return {
    type: event.type,
    description: `${resources.length ? `RESOURCE ${resources.join(' · ')}` : 'STATE'} [${reason === 'resources' ? 'Regeneration' : label}]`,
    className: 'resource',
    order: 30,
    flags: []
  };
}

/** Show weapon trackers alongside the mutually exclusive Stealth and Revealed gates. */
function thiefCoreStateSnapshot(context: ThiefUiContext): RotationStateSnapshotItem[] {
  const state = thiefUiState(context);
  const at = Math.max(0, Number(context.atSeconds || 0));
  const items: RotationStateSnapshotItem[] = [];
  const axes = (state.spinningAxeExpirations || []).filter((expiresAt) => expiresAt > at);
  if (axes.length || [context.build?.weapons?.[0], context.build?.alternateWeapons?.[0]].includes('Axe')) {
    items.push({
      id: 'thief-spinning-axes',
      label: 'Spinning Axes',
      value: `${axes.length}/6`,
      title: axes.length
        ? `Axes available to recall; next axe expires in ${(Math.min(...axes) - at).toFixed(1)}s`
        : 'Axes available to recall'
    });
  }

  const distractingThrowRemaining = Number(state.distractingThrowBuffUntil || 0) - at;
  if (distractingThrowRemaining > 0) {
    items.push({
      id: 'thief-distracting-throw',
      label: 'Distracting Throw',
      value: `${distractingThrowRemaining.toFixed(1)}s`,
      title: 'Time remaining on the outgoing damage bonus granted after a spear finisher'
    });
  }

  const revealedRemaining = Number(state.revealedUntil || 0) - at;
  if (revealedRemaining > 0) {
    return [
      ...items,
      {
        id: 'thief-revealed',
        label: 'Revealed',
        value: `${revealedRemaining.toFixed(1)}s`,
        title: 'Time remaining before Stealth can be gained again'
      }
    ];
  }

  const stealthRemaining = Number(state.stealthStartedAt || 0) <= at ? Number(state.stealthUntil || 0) - at : 0;
  return stealthRemaining > 0
    ? [
        ...items,
        {
          id: 'thief-stealth',
          label: 'Stealth',
          value: `${stealthRemaining.toFixed(1)}s`,
          title: 'Time remaining in Stealth'
        }
      ]
    : items;
}

export const thiefCoreUi = Object.freeze({
  assumptionControls: Object.freeze([...THIEF_CORE_ASSUMPTION_CONTROLS, ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS]),
  rotationStateSnapshot: thiefCoreStateSnapshot,
  weaponSkillMatchesSet: thiefWeaponSkillMatchesSet,
  paletteGroups: (context: ThiefUiContext) =>
    (context.specialization || context.config?.specialization || 'Core') === 'Core' ? thiefStealPaletteGroups() : [],
  resourceViews: (context: ThiefUiContext) => {
    const state = thiefUiState(context);
    const enduranceCapacity = Math.max(
      Number(state.maximumEndurance || 100),
      100 + Number(state.enduranceCapacityBonus || 0)
    );
    const endurance =
      Number(state.maximumEndurance || 100) < enduranceCapacity &&
      Number(state.endurance ?? 100) === Number(state.maximumEndurance || 100)
        ? enduranceCapacity
        : Number(state.endurance ?? enduranceCapacity);
    return [
      {
        id: 'initiative',
        singular: 'initiative',
        plural: 'initiative',
        maximum: Number(state.maximumInitiative || 12),
        value: Number(state.initiative ?? context.initialInitiative ?? 12),
        startMaximum: 15,
        canStart: true,
        buildKey: 'initialInitiative',
        step: 1,
        displayMode: 'pips',
        pipStyle: 'thief-initiative',
        pipRows: Number(state.initiativePipRows || 2),
        shortLabel: 'Init',
        statusLabel: 'Current'
      },
      {
        id: 'endurance',
        singular: 'endurance',
        plural: 'endurance',
        // Specializations publish capacity bonuses; Core renders the shared meter without naming their owner.
        maximum: enduranceCapacity,
        value: endurance,
        canStart: false,
        step: 1,
        displayMode: 'bar',
        pipStyle: 'endurance',
        shortLabel: 'End',
        statusLabel: 'Current',
        // Render the endurance meter beneath the Dodge button rather than as a
        // standalone bar, so the resource sits with the action that spends it.
        paletteSkillId: ID.DODGE
      }
    ];
  },
  paletteSkillAvailability: corePaletteSkillAvailability,
  eventLogRow: thiefCoreEventLogRow
});
