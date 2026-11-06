import { ACTOR } from '#gw2/platform/constants.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { balanceProfileNumber, requireBalanceProfile, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { buildMesmerPacket, buildMesmerStrikes } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { chronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** After trait admission, arm Time Bomb for a completed Time Sink and attribute its delayed explosion to that cast. */
export function completeChronomancerTimeBomb(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const skill = cast.skill;

  if (skill.id !== ID.TIME_SINK) return;

  const state = chronomancerState.from(context.profession);
  const at = cast.fullEnd;

  if (at < state.timeBombUntil) return;

  // Read the selected trait directly so patch edits and removals govern the explosion and its timer together.
  const profile = requireBalanceProfile(context.helpers, TRAIT.TIME_BOMB);
  const timeBomb = requireEffect(profile, 'strike', 'Strike');

  // The removed explosion cannot arm a timer or emit a synthetic hit.
  if (!timeBomb) return;

  const duration = balanceProfileNumber(profile, 'duration');
  // This is the delayed explosion timer; rearming is allowed exactly when it detonates.
  state.timeBombUntil = canonicalTime(at + duration);
  const delivery = mesmerCastDelivery(cast, skill, Infinity);
  {
    const packet = buildMesmerPacket({
      type: 'buff',
      at,
      kind: 'time-bomb',
      stacks: 1,
      duration,
      expiresAt: state.timeBombUntil,
      sourceSkill: skill.name
    });
    context.effects.emit({
      ...delivery,
      kind: 'packet',
      event: packet
    });
  }

  buildMesmerStrikes(
    context,
    {
      id: 'Time Bomb',
      name: 'Time Bomb',
      weapon: 'Utility',
      blade: false
    },
    state.timeBombUntil,
    {
      ...timeBomb,
      name: undefined,
      summonKind: undefined,
      source: 'Player',
      weapon: 'utility'
    }
  ).forEach((packet) => {
    context.effects.emit({
      ...delivery,
      kind: 'packet',
      event: packet
    });
  });
  context.effects.emit({
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.TIME_BOMB, actorType: ACTOR.EFFECT },
    announcement: {
      type: 'trait',
      name: 'Time Bomb',
      at: at,
      sourceSkill: skill.name,
      detail: `explodes after ${duration}s`
    }
  });
}
