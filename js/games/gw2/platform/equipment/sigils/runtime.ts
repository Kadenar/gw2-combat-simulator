import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2SigilIds } from '#gw2/platform/equipment/sigils/loadout.js';
import { SIGIL_IDS, SIGIL_PROCS, SIGIL_BY_ID } from '#gw2/platform/equipment/sigils/data.js';
import { createSigilConditionEvent, createSigilStrikeEvent } from '#gw2/platform/equipment/sigils/proc-events.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2SigilProc, Gw2SigilRuntimeState } from '#gw2/platform/equipment/sigils/types.js';

const procs = SIGIL_PROCS as Readonly<Record<number, Gw2SigilProc>>;

/** Each simulation owns its armed sigil effects; cooldowns live in the shared proc registry. */
export function createSigilRuntimeState(): Gw2SigilRuntimeState {
  return { doomPending: false };
}

/** Actual eligible hits consume Doom once; misses and post-death packets never enter this function. */
function consumeRuntimeDoom(runtime: Gw2Runtime, event: Gw2ResolverEvent): void {
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
export function applyRuntimeSigilStrike(runtime: Gw2Runtime, event: Gw2ResolverEvent): void {
  consumeRuntimeDoom(runtime, event);
  applyRuntimeSigils(runtime, 'strike', event);
}

/** Swap, control and ordinary strike sigils claim namespaced cooldowns in the shared proc registry. */
export function applyRuntimeSigils(
  runtime: Gw2Runtime,
  trigger: 'swap' | 'control' | 'strike',
  event: Gw2ResolverEvent
): void {
  if (runtime.combatStartPending || (runtime.combatStartTime != null && event.at < runtime.combatStartTime)) return;
  if (!runtime.combatActive && runtime.firstHitTime == null && runtime.combatStartTime == null) return;
  if (trigger === 'strike' && (!isGw2PlayerActorEvent(event) || !(Number(event.coefficient) > 0))) return;
  const destination = Number(event.weaponSet);
  const set = trigger === 'swap' && (destination === 1 || destination === 2) ? destination : runtime.activeWeaponSet;
  for (const id of new Set(gw2SigilIds(runtime.config, set))) {
    const proc = procs[id];
    if (proc?.trigger !== trigger) continue;
    // Defiance also represents flanking; ineligible Ice hits must leave the shared ICD untouched.
    if (id === SIGIL_IDS.ICE && !runtime.config.target?.defiant) continue;
    if (!runtime.procs.claimCooldown(`sigil.${id}`, event.at, proc.cooldown)) continue;
    const sourceSkill = event.skillName || (trigger === 'swap' ? 'Swap Weapons' : '');
    if (proc.effect === 'next-hit-condition') {
      runtime.sigil.doomPending = true;
      continue;
    }

    if (proc.effect === 'strike' || proc.effect === 'strike-condition')
      runtime.effects.emit({
        kind: 'packet',
        cause: event,
        event: { ...createSigilStrikeEvent(id, proc, sourceSkill), at: event.at }
      });
    if (proc.effect === 'condition' || (proc.effect === 'strike-condition' && proc.condition))
      runtime.effects.emit({
        kind: 'packet',
        cause: event,
        event: { ...createSigilConditionEvent(id, proc, sourceSkill), at: event.at }
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
          actorType: 'effect'
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
