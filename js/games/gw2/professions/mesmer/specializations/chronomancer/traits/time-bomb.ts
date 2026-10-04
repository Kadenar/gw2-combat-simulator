import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import {
  buildMesmerPacket,
  buildMesmerStrikes,
  mesmerPacketOwner
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { chronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Arms Time Bomb only after a completed Time Sink and keeps its delayed explosion attributed to that cast. */
export function completeChronomancerTimeBomb(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const skill = cast.skill;
  if (skill.id !== ID.TIME_SINK) return;

  const state = chronomancerState.from(context);
  const at = cast.fullEnd;
  if (!hasTrait(context, TRAIT.TIME_BOMB) || at < state.timeBombUntil) return;

  // Read the selected trait directly so patch edits and removals govern the explosion and its timer together.
  const profile = requireBalanceProfileFromContext(context, TRAIT.TIME_BOMB);
  const timeBomb = requireEffect(profile, 'strike', 'Strike');
  // The removed explosion cannot arm a timer or emit a synthetic hit.
  if (!timeBomb) return;
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
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
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
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
      balanceProfileId: profile.id,
      name: undefined,
      summonKind: undefined,
      source: 'Player',
      weapon: 'utility'
    }
  ).forEach((packet) => {
    context.effects.emit({
      ...delivery,
      kind: 'packet',
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  });
  context.effects.emit({
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.TIME_BOMB, actorType: 'effect' },
    announcement: {
      type: 'trait',
      name: 'Time Bomb',
      at: at,
      sourceSkill: skill.name,
      detail: `explodes after ${duration}s`
    }
  });
}
