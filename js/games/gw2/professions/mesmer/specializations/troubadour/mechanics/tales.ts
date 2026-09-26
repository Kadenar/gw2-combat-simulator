import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { TROUBADOUR_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';
import { activeTroubadourInstrumentsAt } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

interface TroubadourTaleInvocation {
  readonly context: MesmerRuntime;
  readonly skill: MesmerSkill;
  readonly at: number;
  readonly castStart: number;
  readonly activationId?: string;
}

const TALE_PROFILE_IDS: Readonly<Record<number, string>> = Object.freeze({
  [ID.TALE_OF_THE_TORTURED_MASTERMIND]: PROFILE.torturedMastermind,
  [ID.TALE_OF_THE_HONORABLE_ROGUE]: PROFILE.honorableRogue,
  [ID.TALE_OF_THE_SOULKEEPER]: PROFILE.soulkeeper,
  [ID.TALE_OF_THE_VALIANT_MARSHAL]: PROFILE.valiantMarshal
});

const TALE_INSTRUMENTS: Readonly<Record<number, string>> = Object.freeze({
  [ID.TALE_OF_THE_SOULKEEPER]: 'Lute',
  [ID.TALE_OF_THE_HONORABLE_ROGUE]: 'Drum',
  [ID.TALE_OF_THE_VALIANT_MARSHAL]: 'Harp',
  [ID.TALE_OF_THE_TORTURED_MASTERMIND]: 'Flute'
});

/** Resolves a Tale's profile boons, matching-instrument note, and Troubadour trait effects together. */
export function resolveTroubadourTale({ context, skill, at, castStart, activationId }: TroubadourTaleInvocation): void {
  const runtime = mesmerMechanicsFor(context);
  const profileId = TALE_PROFILE_IDS[skill.id];
  const profile = profileId ? requireBalanceProfileFromContext(runtime, profileId) : null;
  const partyRecipients = { audience: { recipients: 'party' as const, maximumRecipients: 5 } };

  for (const boon of (profile?.effects || []).filter((effect) => effect.type === 'boon')) {
    runtime.addEvent({
      type: 'buff',
      at,
      kind: String(boon.boon || ''),
      stacks: Number(boon.stacks),
      duration: Number(boon.duration),
      skillName: skill.name,
      sourceSkill: skill.name,
      ...partyRecipients
    });
  }

  const requiredInstrument = TALE_INSTRUMENTS[skill.id];
  // Completion can follow expiry or another performance; award the note from the instrument present at cast start.
  const action = activationId
    ? context.history.filter((event) => event.type === 'action').find((event) => event.activationId === activationId)
    : undefined;
  if (
    requiredInstrument &&
    activeTroubadourInstrumentsAt(
      context.history.filter((event) => event.type === 'mesmer.instrument'),
      castStart,
      action
    ).has(requiredInstrument)
  ) {
    const profile = requireBalanceProfileFromContext(runtime, profileId);
    runtime.resources.queueResources(
      at,
      balanceProfileNumber(profile, 'resourceGain'),
      runtime.activePrimaryWeapon(),
      skill.name
    );
  }

  if (skill.id === ID.TALE_OF_THE_HONORABLE_ROGUE) {
    // Preserve fractional recovery and cap the grant through the shared endurance pool.
    context.endurance.grant(50);
  }

  if (runtime.traits.has(TRAIT.RACONTEUR)) {
    const raconteurProfile = requireBalanceProfileFromContext(runtime, TRAIT.RACONTEUR);
    const protection = requireEffect(raconteurProfile, 'boon', 'protection');
    if (!protection) return;
    runtime.addEvent({
      type: 'buff',
      at,
      kind: String(protection.boon),
      stacks: Number(protection.stacks),
      duration: Number(protection.duration),
      skillName: skill.name,
      sourceSkill: skill.name,
      ...partyRecipients
    });
    runtime.addTraitProc('Raconteur', at, skill.name);
  }
}
