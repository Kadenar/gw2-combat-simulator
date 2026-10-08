import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { buildMesmerPacket, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { createMesmerIllusionRewards, mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-resources.js';
import { triggerRaconteur } from '#gw2/professions/mesmer/specializations/troubadour/traits/performance.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

interface TroubadourTaleInvocation {
  readonly context: MesmerRuntime;
  readonly skill: MesmerSkill;
  readonly at: number;
  readonly eligible: boolean;
}

/** Resolves a Tale's profile boons, matching-instrument note, and Troubadour trait effects together. */
export function resolveTroubadourTale({ context, skill, at, eligible }: TroubadourTaleInvocation): void {
  const profileId = skill.tale?.profileId;
  const profile = profileId ? requireBalanceProfileFromContext(context, profileId) : null;
  const partyRecipients = { audience: { recipients: 'party' as const, maximumRecipients: 5 } };

  for (const boon of (profile?.effects || []).filter((effect) => effect.type === 'boon')) {
    {
      const packet = buildMesmerPacket({
        type: 'buff',
        at,
        kind: String(boon.boon || ''),
        stacks: Number(boon.stacks),
        duration: Number(boon.duration),
        skillName: skill.name,
        sourceSkill: skill.name,
        ...partyRecipients
      });
      context.effects.emit({
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    }
  }

  if (eligible && profileId) {
    const profile = requireBalanceProfileFromContext(context, profileId);
    createMesmerIllusionRewards(context).queueResources(
      at,
      balanceProfileNumber(profile, 'resourceGain'),
      mesmerActivePrimaryWeapon(context),
      skill.name
    );
  }

  triggerRaconteur(context, skill, at);
}
