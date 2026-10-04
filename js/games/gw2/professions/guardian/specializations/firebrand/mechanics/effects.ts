import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { expireCharges, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';

import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;
const ASHES = 'guardian.firebrand.ashes';
export const FIREBRAND_ASHES_EXPIRE = 'guardian.firebrand.ashes-expiry';

/** Derived trait effects inherit attribution and causality, never the triggering buff's recipients or duration. */
export function attribution(event: Gw2ResolverEvent) {
  return {
    source: 'guardian',
    actorType: 'player' as const,
    skillId: event.skillId,
    skillName: event.skillName,
    activationId: event.activationId,
    causalOrder: event.causalOrder ?? event.eventOrder,
    triggeredBy: event.skillName
  };
}

/** Finite allied opportunities enter ordinary hostile resolution, which rejects precombat and post-death outcomes. */
export function alliedAshes(
  runtime: Runtime,
  event: Gw2ResolverEvent,
  count: number,
  duration: number,
  source: { maximumAllies: number; priority: number; skillName: string; name: string }
): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.ashes);
  const burn = requireEffect(profile, 'condition', 'Burning');
  if (!burn) return;
  const procs = gw2AlliedPlayerProcTimeline(runtime.config, {
    start: runtime.time,
    duration,
    maximumAllies: source.maximumAllies,
    maximumPerAlly: count,
    internalCooldown: balanceProfileNumber(profile, 'internalCooldown')
  });
  for (const proc of procs)
    runtime.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        ...attribution(event),
        at: proc.at,
        priority: source.priority,
        sourceId: 'guardian.ashes-of-the-just',
        skillId: ID.ASHES_OF_THE_JUST,
        skillName: source.skillName,
        activationId: `${event.activationId}:ally:${proc.allyIndex}:${proc.procIndex}`,
        name: `${source.name} — Ally ${proc.allyIndex} Burning`,
        condition: String(burn.condition),
        stacks: effectNumber(profile, burn, 'stacks'),
        duration: effectNumber(profile, burn, 'duration'),
        metadata: { triggeredByAlly: proc.allyIndex }
      })
    });
}

/** Accepted Ashes casts grant after 560 ms, without exposing charges at acceptance or waiting for animation end. */
export function startFirebrandAshes(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): void {
  runtime.scheduleForCast(ASHES, canonicalTime(cast.start + 0.56), cast);
}

/** The application boundary grants Might and installs the selected charge components together. */
function grantFirebrandAshes(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): void {
  const event: Gw2ResolverEvent = {
    type: 'buff',
    at: runtime.time,
    source: 'guardian',
    sourceId: cast.skill.id,
    actorType: 'player',
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id
  };
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.ashes);
  const might = requireEffect(profile, 'boon', 'might');
  if (might)
    runtime.effects.emit({
      kind: 'packet',
      event: {
        ...event,
        at: runtime.time,
        kind: 'might',
        stacks: effectNumber(profile, might, 'stacks'),
        duration: effectNumber(profile, might, 'duration'),
        audience: { recipients: 'party' }
      }
    });
  const buff = requireEffect(profile, 'buff', 'ashes-of-the-just');
  const burn = requireEffect(profile, 'condition', 'Burning');
  if (!buff || !burn) return;
  const state = firebrandState.from(runtime);
  const duration = effectNumber(profile, buff, 'duration');
  state.ashes = grantCharges(
    balanceProfileNumber(profile, 'maximumStacks'),
    gw2EffectExpiresAt(runtime.time, duration)
  );
  state.ashesBurnDuration = effectNumber(profile, burn, 'duration');
  runtime.effects.emit({
    kind: 'packet',
    event: {
      ...event,
      at: runtime.time,
      name: 'Ashes of the Just',
      kind: 'ashes-of-the-just',
      stacks: state.ashes.charges,
      duration,
      audience: { recipients: 'party' }
    }
  });
  runtime.schedule(FIREBRAND_ASHES_EXPIRE, state.ashes.expiresAt, undefined, undefined, 10);
  alliedAshes(runtime, event, state.ashes.charges, state.ashes.expiresAt - runtime.time, {
    maximumAllies: Infinity,
    priority: 0,
    skillName: 'Epilogue: Ashes of the Just',
    name: 'Ashes of the Just'
  });
}

export const firebrandEffectTasks = {
  [ASHES](runtime: Runtime, data: unknown) {
    grantFirebrandAshes(runtime, (data as { cast: RuntimeCast<GuardianSkill> }).cast);
  },
  [FIREBRAND_ASHES_EXPIRE](runtime: Runtime) {
    expireCharges(firebrandState.from(runtime).ashes, runtime.time);
  }
};
