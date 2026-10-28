import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { SIGIL_BY_ID, SIGIL_IDS, SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';
import { gw2SigilIds } from '#gw2/platform/equipment/sigils/loadout.js';
import { createSigilConditionEvent, createSigilDamagePayload } from '#gw2/platform/equipment/sigils/proc-events.js';
import { SEVERANCE_BUFF_POLICY } from '#gw2/platform/equipment/sigils/severance.js';
import type { Gw2SigilProc, Gw2SigilRuntimeState } from '#gw2/platform/equipment/sigils/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

const procs = SIGIL_PROCS as Readonly<Record<number, Gw2SigilProc>>;

/** Sigils own their armed state and use shared combat facts, seeded rolls, cooldowns and effect grants. */
export interface SigilRuntimeContext extends Pick<
  MechanicContext,
  'config' | 'effects' | 'engagement' | 'activeWeaponSet' | 'random'
> {
  readonly sigil: Gw2SigilRuntimeState;
  readonly firstHitTime: number | null;
  readonly procs: Pick<MechanicContext['procs'], 'claimCooldown' | 'deadline'>;
  readonly endurance: Pick<MechanicContext['endurance'], 'grant'>;
}

/** Each simulation owns its armed sigil effects; cooldowns live in the shared proc registry. */
export function createSigilRuntimeState(): Gw2SigilRuntimeState {
  return { doomPending: false };
}

/** Actual eligible hits consume Doom once; misses and post-death packets never enter this function. */
function consumeRuntimeDoom(runtime: SigilRuntimeContext, event: Gw2ResolverEvent): void {
  if (!runtime.sigil.doomPending || !isGw2PlayerActorEvent(event) || !(Number(event.coefficient) > 0)) return;

  runtime.sigil.doomPending = false;
  runtime.effects.emit({
    kind: 'packet',
    cause: event,
    event: {
      ...createSigilConditionEvent(SIGIL_IDS.DOOM, procs[SIGIL_IDS.DOOM], event.skillName || ''),
      at: event.at
    }
  });
  // The delayed proc carries Doom's artwork so every view displays the sigil's icon.
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'sigil',
      name: 'Sigil of Doom',
      at: event.at,
      sourceSkill: event.skillName,
      detail: '',
      icon: procs[SIGIL_IDS.DOOM].icon
    }
  });
}

/** Accepted strikes consume armed sigils before triggering ordinary strike procs. */
export function applyRuntimeSigilStrike(runtime: SigilRuntimeContext, event: Gw2ResolverEvent): void {
  consumeRuntimeDoom(runtime, event);
  applyRuntimeSigils(runtime, 'strike', event);
}

/** Swap, control and ordinary strike sigils claim namespaced cooldowns in the shared proc registry. */
export function applyRuntimeSigils(
  runtime: SigilRuntimeContext,
  trigger: 'swap' | 'control' | 'strike',
  event: Gw2ResolverEvent
): void {
  if (!runtime.engagement.hostileEffectsAllowed(event.at)) return;

  if (!runtime.engagement.active && runtime.firstHitTime == null && runtime.engagement.startTime == null) return;

  if (trigger === 'strike' && (!isGw2PlayerActorEvent(event) || !(Number(event.coefficient) > 0))) return;

  const destination = Number(event.weaponSet);
  const set = trigger === 'swap' && (destination === 1 || destination === 2) ? destination : runtime.activeWeaponSet;
  for (const id of new Set(gw2SigilIds(runtime.config, set))) {
    const proc = procs[id];

    if (proc?.trigger !== trigger) continue;

    // Defiance also represents flanking; ineligible Ice hits must leave the shared ICD untouched.
    if (id === SIGIL_IDS.ICE && !runtime.config.target?.defiant) continue;

    const cooldownKey = `sigil.${id}`;

    if (id === SIGIL_IDS.SEVERANCE) {
      // Blocked controls never advance the stream; failed rolls leave the cooldown available.
      if (!isInternalCooldownReady(event.at, runtime.procs.deadline(cooldownKey))) continue;

      const chance = runtime.config.procRateOverrides?.['sigil.severance'] ?? 1;

      if (!runtime.random.roll(chance, 'sigil.severance')) continue;
    }

    if (!runtime.procs.claimCooldown(cooldownKey, event.at, proc.cooldown)) continue;

    const sourceSkill = event.skillName || (trigger === 'swap' ? 'Swap Weapons' : '');

    if (proc.effect === 'next-hit-condition') {
      runtime.sigil.doomPending = true;
      continue;
    }

    for (const payload of createSigilDamagePayload(id, proc, sourceSkill))
      runtime.effects.emit({
        kind: 'packet',
        cause: event,
        event: {
          ...payload,
          at: event.at,
          // Only the immediate swap strike samples the outgoing set; delayed conditions keep their live queries.
          ...(trigger === 'swap' && payload.type === 'damage' && event.weaponSwapFromSet != null
            ? { weaponSwapFromSet: event.weaponSwapFromSet }
            : {})
        }
      });

    if (proc.effect === 'endurance') runtime.endurance.grant(proc.amount ?? 0);

    if (proc.effect === 'severance')
      runtime.effects.emit({
        kind: 'packet',
        cause: event,
        event: {
          type: 'buff',
          at: event.at,
          kind: 'sigil-severance',
          stacks: 1,
          duration: proc.duration,
          source: 'Sigil',
          sourceId: `sigil.${SIGIL_IDS.SEVERANCE}`,
          actorType: ACTOR.EFFECT
        }
      });

    runtime.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'sigil',
        name: `Sigil of ${SIGIL_BY_ID[id].name}`,
        at: event.at,
        sourceSkill: sourceSkill,
        detail: '',
        icon: proc.icon
      }
    });
  }
}

/** Register both configured sets for the run so swapping cannot retire an active effect's owner. */
export function sigilBuffPolicies(config: Gw2Config): readonly BuffStatePolicy[] {
  return Object.freeze(
    [1, 2].some((set) => gw2SigilIds(config, set).includes(SIGIL_IDS.SEVERANCE)) ? [SEVERANCE_BUFF_POLICY] : []
  );
}
