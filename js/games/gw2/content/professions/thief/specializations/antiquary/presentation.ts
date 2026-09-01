import { THIEF_ANTIQUARY_ASSUMPTION_CONTROLS } from '#gw2/content/professions/thief/build/antiquary-assumptions.js';
import { THIEF_ARTIFACT_IDS, THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import { thiefUiState } from '#gw2/content/professions/thief/core/presentation.js';
import type { RotationStateSnapshotItem } from '#gw2/platform/engine/types.js';
import type { ThiefSkill, ThiefUiContext } from '#gw2/content/professions/thief/types.js';

/** Surfaces Combat High plus artifact effects with duration or consumable charges. */
function antiquaryStateSnapshot(context: ThiefUiContext): RotationStateSnapshotItem[] {
  const state = thiefUiState(context);
  const at = Math.max(0, Number(context.atSeconds || 0));
  const items: RotationStateSnapshotItem[] = [];
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
    ['antiquary-chak-shield', 'Chak Shield', Number(state.chakInitiativeRefundUntil || 0)]
  ];
  for (const [id, label, expiresAt] of timedEffects) {
    const remaining = expiresAt - at;
    if (remaining <= 0) continue;
    items.push({ id, label, value: `${remaining.toFixed(1)}s`, title: `${label} artifact effect remaining` });
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
      title: `${label} charges and time remaining`
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
  skillBarGroups: () => [
    {
      id: 'thief-artifacts-offensive',
      label: 'Offensive Artifacts',
      skillIds: [...THIEF_ARTIFACT_IDS.OFFENSIVE],
      color: '#c65d68'
    },
    {
      id: 'thief-artifacts-defensive',
      label: 'Defensive Artifacts',
      skillIds: [...THIEF_ARTIFACT_IDS.DEFENSIVE],
      color: '#6f9cb8'
    }
  ],
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
