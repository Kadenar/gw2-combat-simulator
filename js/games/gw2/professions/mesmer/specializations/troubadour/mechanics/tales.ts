import { RECIPIENT } from '#gw2/platform/constants.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import { activeTroubadourInstrumentsAt } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { buildMesmerPacket, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { createMesmerIllusionRewards, mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-resources.js';
import { troubadourTaleResolved } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/trigger-points.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { startTroubadourInstrument } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import { MESMER_TROUBADOUR_INSTRUMENTS } from '#gw2/professions/mesmer/specializations/troubadour/skills/index.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { canonicalTime } from '#kernel/core/clock.js';

interface TroubadourTaleInvocation {
  readonly context: MesmerRuntime;
  readonly skill: MesmerSkill;
  readonly at: number;
  readonly eligible: boolean;
}

/** Resolves a Tale's profile boons, eligible performance notes, and Troubadour trait effects together. */
function resolveTroubadourTale({ context, skill, at, eligible }: TroubadourTaleInvocation): void {
  const action = requireSkillAction(skill, 'tale');
  const partyRecipients = { audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 } };

  for (const boon of action.effects.filter((effect) => effect.type === 'boon')) {
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

  if (eligible && skill.tale) {
    createMesmerIllusionRewards(context).queueResources(
      at,
      skillNumber(skill, 'noteGain'),
      mesmerActivePrimaryWeapon(context),
      skill.name
    );
  }

  context.fireTrigger(troubadourTaleResolved, { skill, at });
}

/** Capture instrument eligibility at acceptance and resolve the Tale using that snapshot at commitment. */
const troubadourTaleActions: NonNullable<RuntimeHooks<MesmerRuntimeState, MesmerSkill>['sideEffectHandlers']> = {
  'mesmer.troubadour.play-all-instruments'(runtime, context) {
    if (context.kind !== 'cast') return;

    // Capture the pre-grant count once so starting one instrument cannot lengthen the next one's window.
    const at = runtime.time;
    const playing = activeTroubadourInstrumentsAt(runtime.facts.read(), at).size;
    const duration =
      skillNumber(context.skill, 'baseDuration') + playing * skillNumber(context.skill, 'durationPerTier');
    const expiresAt = canonicalTime(at + duration);
    const instruments = new Set(
      Object.values(MESMER_TROUBADOUR_INSTRUMENTS).map((instrument) => instrument.instrument)
    );
    for (const instrument of instruments) {
      startTroubadourInstrument(runtime, instrument, at, expiresAt, mesmerCastDelivery(context.cast));
    }
  },
  // Capture the event-order-sensitive gate while the accepted action is still the latest history entry.
  'mesmer.troubadour.prepare-tale'(runtime, context) {
    if (context.kind !== 'cast') return;

    const tale = context.skill.tale;
    const action = runtime.facts
      .read()
      .find((event) => event.type === 'action' && event.activationId === context.cast.id);
    const instruments = activeTroubadourInstrumentsAt(
      runtime.facts.read().filter((event) => event.type === 'mesmer.instrument'),
      context.cast.start,
      action
    );
    // Count distinct playing instruments at acceptance so expiry during recitation cannot revoke earned notes.
    runtime.profession.core.castDetails.get(context.cast.id)!.taleEligible = Boolean(
      tale &&
      (tale.minimumInstruments !== undefined
        ? instruments.size >= tale.minimumInstruments
        : instruments.has(tale.instrument))
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
