import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

interface TroubadourTaleInvocation {
  readonly context: MesmerRuntime;
  readonly skill: MesmerSkill;
  readonly at: number;
  readonly eligible: boolean;
}

/** Resolves a Tale's profile boons, matching-instrument note, and Troubadour trait effects together. */
export function resolveTroubadourTale({ context, skill, at, eligible }: TroubadourTaleInvocation): void {
  const runtime = mesmerMechanicsFor(context);
  const profileId = skill.tale?.profileId;
  const profile = profileId ? requireBalanceProfileFromContext(context, profileId) : null;
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

  if (eligible && profileId) {
    const profile = requireBalanceProfileFromContext(context, profileId);
    runtime.resources.queueResources(
      at,
      balanceProfileNumber(profile, 'resourceGain'),
      runtime.activePrimaryWeapon(),
      skill.name
    );
  }

  if (hasTrait(context, TRAIT.RACONTEUR)) {
    const raconteurProfile = requireBalanceProfileFromContext(context, TRAIT.RACONTEUR);
    const protection = requireEffect(raconteurProfile, 'boon', 'protection');
    if (!protection) return;
    runtime.addEvent({
      type: 'buff',
      at,
      kind: String(protection.boon),
      stacks: Number(protection.stacks),
      duration: protection.duration,
      skillName: skill.name,
      sourceSkill: skill.name,
      ...partyRecipients
    });
    runtime.addTraitProc('Raconteur', at, skill.name);
  }
}
