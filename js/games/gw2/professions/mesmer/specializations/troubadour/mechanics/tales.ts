import { RECIPIENT } from '#gw2/platform/constants.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import { activeTroubadourInstrumentsAt } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import { balanceNumberFromContext, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { buildMesmerPacket, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { createMesmerIllusionRewards, mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-resources.js';
import { troubadourTaleResolved } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/trigger-points.js';
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
  const partyRecipients = { audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 } };

  for (const boon of (profile?.effects || []).filter((effect) => effect.type === 'boon')) {
    const packet = buildMesmerPacket({
      type: 'buff',
      at,
      kind: String(boon.boon || '').toLowerCase(),
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

  if (eligible && profileId) {
    createMesmerIllusionRewards(context).queueResources(
      at,
      balanceNumberFromContext(context, profileId, 'resourceGain'),
      mesmerActivePrimaryWeapon(context),
      skill.name
    );
  }

  context.fireTrigger(troubadourTaleResolved, { skill, at });
}

/** Capture instrument eligibility at acceptance and resolve the Tale using that snapshot at commitment. */
const troubadourTaleActions: NonNullable<RuntimeHooks<MesmerRuntimeState, MesmerSkill>['sideEffectHandlers']> = {
  // Capture the event-order-sensitive gate while the accepted action is still the latest history entry.
  'mesmer.troubadour.prepare-tale'(runtime, context) {
    if (context.kind !== 'cast') return;

    const required = context.skill.tale?.instrument;
    const action = runtime.facts
      .read()
      .find((event) => event.type === 'action' && event.activationId === context.cast.id);
    runtime.profession.core.castDetails.get(context.cast.id)!.taleEligible = Boolean(
      required &&
      activeTroubadourInstrumentsAt(
        runtime.facts.read().filter((event) => event.type === 'mesmer.instrument'),
        context.cast.start,
        action
      ).has(required)
    );
  },
  'mesmer.troubadour.resolve-tale'(runtime, context) {
    if (context.kind !== 'cast') return;

    resolveTroubadourTale({
      context: runtime,
      skill: context.skill,
      at: runtime.time,
      eligible: Boolean(runtime.profession.core.castDetails.get(context.cast.id)?.taleEligible)
    });
  }
};

/** Registers tale commitment actions with the Troubadour hook assembly. */
export const troubadourTaleLifecycle = {
  sideEffectHandlers: troubadourTaleActions
} satisfies RuntimeHooks<MesmerRuntimeState, MesmerSkill>;
