import { THIEF_ANTIQUARY_ASSUMPTION_CONTROLS } from '#gw2/professions/thief/build/antiquary-assumptions.js';
import {
  THIEF_ARTIFACT_IDS,
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT
} from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { getActiveTraits } from '#gw2/professions/thief/data/traits-data.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import { thiefUiState } from '#gw2/professions/thief/core/presentation.js';
import type { RotationStateSnapshotItem } from '#gw2/platform/engine/profession/types.js';
import type { ThiefSkill, ThiefUiContext } from '#gw2/professions/thief/types.js';

/** Surfaces Combat High plus artifact effects with duration or consumable charges. */
function antiquaryStateSnapshot(context: ThiefUiContext): RotationStateSnapshotItem[] {
  const state = thiefUiState(context);
  const at = Math.max(0, Number(context.atSeconds || 0));
  const items: RotationStateSnapshotItem[] = [];
  // Pincher is spending progress, while Scuffle predicts the next automatic artifact replacement.
  if (
    hasTrait(context, TRAIT.PRODIGIOUS_PINCHER) ||
    getActiveTraits(context.build?.specializations || []).some((trait) => trait.id === TRAIT.PRODIGIOUS_PINCHER)
  ) {
    const threshold = balanceProfileValueFromContext(context, PROFILE.prodigiousPincher, 'threshold', 15);
    const spent = Math.max(0, Number(state.initiativeSpentSincePilfer || 0));
    items.push({
      id: 'antiquary-prodigious-pincher',
      label: 'Prodigious Pincher',
      value: `${spent}/${threshold}`,
      title: `Initiative spent toward the next pilfer; ${Math.max(0, threshold - spent)} more required`
    });
  }

  const nextPilferRemaining = Number(state.nextSkrittScufflePilferAt || 0) - at;
  if (nextPilferRemaining > 0) {
    items.push({
      id: 'antiquary-skritt-scuffle',
      label: 'Skritt Scuffle',
      value: `${nextPilferRemaining.toFixed(1)}s`,
      title: 'Time until the next artifact set is pilfered'
    });
  }

  const combatHighRemaining = Number(state.combatHighExpiresAt || 0) - at;
  const combatHighStacks = Math.max(0, Math.min(10, Math.trunc(Number(state.combatHighStacks || 0))));
  if (combatHighRemaining > 0 && combatHighStacks > 0) {
    items.push({
      id: 'antiquary-combat-high',
      label: 'Combat High',
      value: `${combatHighStacks}/10 · ${combatHighRemaining.toFixed(1)}s`,
      title: 'Combat High stacks and time until the remaining stacks decay'
    });
  }

  const timedEffects: readonly [string, string, number][] = [
    ['antiquary-exhilarating-ephemera', 'Exhilarating Ephemera', Number(state.antiquaryDamageUntil || 0)],
    ['antiquary-kryptis-turret', 'Kryptis Turret', Number(state.kryptisDamageUntil || 0)],
    ['antiquary-forged-surfer-dash', 'Forged Surfer Dash', Number(state.forgedSurferBombDropUntil || 0)],
    ['antiquary-chak-shield', 'Chak Shield', Number(state.chakInitiativeRefundUntil || 0)]
  ];
  for (const [id, label, expiresAt] of timedEffects) {
    const remaining = expiresAt - at;
    if (remaining <= 0) continue;
    items.push({
      id,
      label,
      value: `${remaining.toFixed(1)}s`,
      title:
        id === 'antiquary-forged-surfer-dash'
          ? 'Time remaining on the additional bomb-drop buff'
          : id === 'antiquary-kryptis-turret'
            ? 'Time remaining on the strike damage modifier'
            : id === 'antiquary-chak-shield'
              ? 'Time remaining on initiative refunds for weapon skills'
              : `${label} artifact effect remaining`
    });
  }

  for (const [id, label, chargesValue, expiresAt] of [
    ['antiquary-metal-legion-guitar', 'Metal Legion Guitar', state.stealthAttackCharges, state.stealthAttackExpiresAt],
    ['antiquary-mistburn-mortar', 'Mistburn Mortar', state.mistburnCharges, state.mistburnExpiresAt]
  ] as const) {
    const remaining = Number(expiresAt || 0) - at;
    const charges = Math.max(0, Math.trunc(Number(chargesValue || 0)));
    if (remaining <= 0 || charges <= 0) continue;
    items.push({
      id,
      label,
      value: `${charges} ${charges === 1 ? 'charge' : 'charges'} · ${remaining.toFixed(1)}s`,
      title:
        id === 'antiquary-metal-legion-guitar'
          ? 'Stealth attacks remaining without entering Stealth, and time until they expire'
          : `${label} charges and time remaining`
    });
  }

  const holoExpiries = (state.holoUtilityCooldownReductionExpirations || [])
    .map(Number)
    .filter((expiry) => expiry > at);
  if (holoExpiries.length) {
    items.push({
      id: 'antiquary-holo-dancer-decoy',
      label: 'Holo-Dancer Decoy',
      value: `${holoExpiries.length} ${holoExpiries.length === 1 ? 'use' : 'uses'} · ${(
        Math.min(...holoExpiries) - at
      ).toFixed(1)}s`,
      title: 'Reduced-recharge utility uses and time until the next use expires'
    });
  }

  return items;
}

export const antiquaryUi = Object.freeze({
  assumptionControls: THIEF_ANTIQUARY_ASSUMPTION_CONTROLS,
  rotationStateSnapshot: antiquaryStateSnapshot,
  paletteGroups: () => {
    const artifactGroups: readonly [string, string, readonly number[], string][] = [
      ['thief-artifacts-offensive', 'Offensive', THIEF_ARTIFACT_IDS.OFFENSIVE, '#c65d68'],
      ['thief-artifacts-defensive', 'Defensive', THIEF_ARTIFACT_IDS.DEFENSIVE, '#6f9cb8']
    ];
    return [
      {
        id: 'thief-profession',
        label: 'F',
        skillIds: [ID.SKRITT_SWIPE],
        color: '#9a535c',
        resourceAnchor: true,
        // Shares the artifact stack so CSS can seat the offensive/defensive
        // rows beside Skritt Swipe rather than stacking them below it.
        className: 'antiquary-f-skill',
        stackId: 'thief-artifacts'
      },
      ...artifactGroups.map(([id, label, artifactIds, color]) => ({
        id,
        label,
        // Always list every artifact; paletteSkillAvailability greys out the
        // ones that are not pilfered yet or already spent this pilfer, so a
        // used artifact stays visible but disabled instead of disappearing.
        skillIds: [...artifactIds],
        color,
        stackId: 'thief-artifacts',
        className: `antiquary-artifact-group antiquary-${id.replace('thief-', '')}`
      }))
    ];
  },
  // Available artifact uses are a backend gate (state.artifactUsesRemaining),
  // not a palette meter, so Antiquary contributes no artifact resource view.
  paletteSkillAvailability: (context: ThiefUiContext, skill: ThiefSkill) => {
    const state = thiefUiState(context);
    if (skill.artifactKind) {
      const hasUse = Number(state.artifactUsesRemaining || 0) > 0;
      const inSlot = Boolean(state.artifactSlots?.some((slot) => slot.skillId === skill.id));
      return {
        available: hasUse && inSlot,
        message:
          hasUse && inSlot
            ? ''
            : !hasUse
              ? 'Pilfer with Skritt Swipe before using an artifact'
              : 'This artifact was already used this pilfer'
      };
    }

    if (skill.id === ID.RESHUFFLE) {
      // Reshuffle is always greyed-out in the palette; it is queue-only and blocked by availability when there is nothing to reroll
      return {
        available: false,
        message: 'All artifacts are already available to choose'
      };
    }

    return { available: true, message: '' };
  }
});
