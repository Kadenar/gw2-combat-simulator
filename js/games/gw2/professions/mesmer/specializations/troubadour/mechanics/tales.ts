/** Tales own their accepted instrument eligibility while the instrument owner interprets committed windows. */
import { ACTOR, RECIPIENT } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { StatusEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { createMesmerIllusionRewards, mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-resources.js';
import { playingTroubadourInstruments } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-windows.js';
import { startTroubadourInstrument } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import { troubadourTaleResolved } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/trigger-points.js';
import { MESMER_TROUBADOUR_INSTRUMENTS } from '#gw2/professions/mesmer/specializations/troubadour/skills/index.js';
import type { MesmerRuntime, MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

interface TroubadourTaleInvocation {
  readonly context: MesmerRuntime;
  readonly skill: MesmerSkill;
  readonly at: number;
  readonly eligible: boolean;
  readonly delivery: EffectDelivery;
}

const taleEligibility = new WeakMap<RuntimeCast<MesmerSkill>, boolean>();

/** Resolves a Tale's profile boons, eligible performance notes, and Troubadour trait effects together. */
function resolveTroubadourTale({ context, skill, at, eligible, delivery }: TroubadourTaleInvocation): void {
  const action = requireSkillAction(skill, 'tale');
  const partyRecipients = { audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 } };

  // A Tale owns all its grants, so unrelated Tales cannot collapse into an anonymous buff source.
  context.effects.emit({
    ...delivery,
    kind: 'profile',
    profile: skill,
    at,
    effects: action.effects
      .filter((effect): effect is Extract<StatusEffect, { type: 'boon' }> => effect.type === 'boon')
      .map((boon) => ({ ...boon, ...partyRecipients })),
    attribution: {
      source: 'mesmer',
      sourceId: skill.id,
      skillId: skill.id,
      actorType: ACTOR.PLAYER,
      skillName: skill.name
    },
    transform: (event) => ({ ...event, name: skill.name, sourceSkill: skill.name })
  });

  // Instrument eligibility gates only the note reward; the Tale still grants its boons and notifies traits without it.
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
    const playing = playingTroubadourInstruments(runtime.facts, at).size;
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
    const instruments = playingTroubadourInstruments(runtime.facts, context.cast.start, context.cast.id);
    // Count distinct playing instruments at acceptance so expiry during recitation cannot revoke earned notes.
    taleEligibility.set(
      context.cast,
      Boolean(
        tale &&
        (tale.minimumInstruments !== undefined
          ? instruments.size >= tale.minimumInstruments
          : instruments.has(tale.instrument))
      )
    );
  },
  'mesmer.troubadour.resolve-tale'(runtime, context) {
    if (context.kind !== 'cast') return;

    const eligible = taleEligibility.get(context.cast) === true;
    taleEligibility.delete(context.cast);
    resolveTroubadourTale({
      context: runtime,
      skill: context.skill,
      at: runtime.time,
      delivery: mesmerCastDelivery(context.cast),
      eligible
    });
  }
};

/** Registers tale commitment actions with the Troubadour hook assembly. */
export const troubadourTaleLifecycle = {
  sideEffectHandlers: troubadourTaleActions,
  onCastCancel(_runtime, cast) {
    taleEligibility.delete(cast);
  }
} satisfies RuntimeHooks<MesmerRuntimeState, MesmerSkill>;
