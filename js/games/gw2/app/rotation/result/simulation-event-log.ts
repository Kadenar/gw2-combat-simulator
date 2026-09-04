/** Maps simulation events to display rows and mounts the rotation event-log view. */
import type { SchedulerRecord, SimulationEvent } from '#gw2/platform/engine/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import {
  EVENT_LOG_ORDER,
  mountEventLog,
  normalizeEventLogDescriptor
} from '#gw2/app/presentation/results/event-log-view.js';
import type { EventLogRow } from '#gw2/app/presentation/results/event-log-view.js';
import type { ProfessionAppContract, ProfessionAppState } from '#gw2/app/types.js';
import { professionEndState } from '#gw2/app/rotation/shared/context.js';
import { effectName, resultCombatReferenceMs } from '#gw2/app/rotation/result/model.js';
import type { Gw2ApplicationBuild } from '#gw2/platform/builds/types.js';

type OrderedEventLogRow = EventLogRow & { readonly order: number };

/** Converts stable minion ownership ids into readable per-minion log labels. */
function minionAttackerLabel(event: SimulationEvent): string {
  const match = /^minion:([^:]+):(\d+)$/.exec(String(event.summonOwner || ''));
  if (!match) return '';
  const name = match[1]
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return name ? `${name} #${Number(match[2]) + 1}` : '';
}

export function simulationEventLogRows(
  result: Gw2SimulationResult | null | undefined,
  build: Gw2ApplicationBuild | null = null,
  profession: ProfessionAppContract | null = null
): EventLogRow[] {
  const rows: OrderedEventLogRow[] = [];
  const professionUi = profession?.ui;
  const displayReferenceSeconds = resultCombatReferenceMs(result) / 1000;
  const endState = professionEndState(result);
  const eliteNames = new Set(
    (profession?.catalog?.specializations || [])
      .filter((specialization) => specialization.elite)
      .map((specialization) => specialization.name)
  );
  const specialization =
    String(build?.specialization || '').trim() ||
    build?.specializations?.find((selection) => eliteNames.has(selection.name))?.name ||
    'Core';
  // Reuse the active profession's effect labels in the event log instead of maintaining a second name table.
  const effectPresentations =
    professionUi?.effectPresentations?.({
      result,
      build,
      catalog: profession?.catalog,
      profession,
      specialization
    }) || [];
  const resourceDefinition =
    endState.resourceDefinition && typeof endState.resourceDefinition === 'object'
      ? (endState.resourceDefinition as SchedulerRecord)
      : {};
  const maximumResource = Number(resourceDefinition.maximum || 0);
  const push = (at: unknown, type: string, description: string, className = '', phantasmClone = false): void => {
    const displayAt = Number(at || 0) - displayReferenceSeconds;
    rows.push({
      at: Math.abs(displayAt) < 1e-12 ? 0 : displayAt,
      type,
      description,
      className,
      phantasmClone,
      order: EVENT_LOG_ORDER[type] ?? 80
    });
  };

  const pushProfessionRow = (event: SimulationEvent): void => {
    const normalized = normalizeEventLogDescriptor(
      professionUi?.eventLogRow?.(
        {
          result,
          build,
          profession,
          specialization,
          displayReferenceSeconds,
          maximumResource
        },
        event
      )
    );
    if (normalized === null) return;
    if (normalized) {
      const { flags, ...descriptor } = normalized;
      const displayAt = Number(event.at || 0) - displayReferenceSeconds;
      rows.push({
        at: Math.abs(displayAt) < 1e-12 ? 0 : displayAt,
        ...descriptor,
        phantasmClone: flags.includes('phantasm-clone')
      });
      return;
    }

    const message = `UNPRESENTED CUSTOM EVENT ${event.type}`;
    globalThis.console?.warn?.(message, event);
    push(event.at, 'diagnostic', message, 'diagnostic');
  };

  for (const event of result?.events || []) {
    if (event.type === 'damage' || event.type === 'condition') continue;
    switch (event.type) {
      case 'combat_start':
        push(event.at, event.type, 'COMBAT START', 'trigger');
        break;
      case 'action': {
        const durationMs = Math.max(0, Math.round((Number(event.endsAt || event.at) - Number(event.at || 0)) * 1000));
        push(event.at, 'cast', `CAST ${event.name} (${durationMs}ms)`);
        push(event.endsAt, 'cast_end', `END ${event.name}`);
        break;
      }

      case 'resource': {
        const amount = Number(event.amount || 0);
        const resource = String(event.resource || 'resource');
        const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;
        const reason = event.reason ? ` [${event.reason}]` : '';
        const created = (Array.isArray(event.created) ? event.created : [])
          .map((rawClone: unknown) => {
            const clone = rawClone && typeof rawClone === 'object' ? (rawClone as SchedulerRecord) : {};
            return `Clone #${String(clone.id ?? '')}${clone.weapon ? ` [${String(clone.weapon)}]` : ''}`;
          })
          .join(', ');
        const isCloneResource = resource === 'clones';
        if (amount > 0) {
          push(
            event.at,
            event.type,
            `${singular.toUpperCase()} SPAWNED x${amount} -> ${event.value}/${maximumResource}${reason}${created ? ` (${created})` : ''}`,
            'resource',
            isCloneResource
          );
        } else {
          push(
            event.at,
            event.type,
            `${resource.toUpperCase()} SPENT x${Math.abs(amount)} -> ${event.value}/${maximumResource}${reason}`,
            'resource',
            isCloneResource
          );
        }

        break;
      }

      case 'marker':
        push(event.at, event.type, `EVENT ${event.name}${event.detail ? ` - ${event.detail}` : ''}`, 'trigger');
        break;
      case 'proc':
        push(
          event.at,
          event.type,
          `${String(event.procType || 'effect').toUpperCase()} ${event.name}${event.sourceSkill ? ` [${event.sourceSkill}]` : ''}${event.detail ? ` - ${event.detail}` : ''}`,
          event.procType || 'trigger'
        );
        break;
      case 'weapon_set':
        push(event.at, 'trigger', `WEAPON SET ${event.weaponSet}`, 'trigger');
        break;
      case 'control':
        push(event.at, 'trigger', `CONTROL ${event.skillName}`, 'trigger');
        break;
      case 'weakness_vulnerability':
        push(event.at, 'trigger', `WEAKNESS/VULNERABILITY TRIGGER ${event.skillName}`, 'trigger');
        break;
      case 'peitha':
        if (!build || build.relic === 'Peitha') {
          push(event.at, 'trigger', `PEITHA TRIGGER ${event.skillName}`, 'trigger');
        }

        break;
      case 'buff':
        push(
          event.at,
          'trigger',
          `BUFF ${effectName(event.kind, event, effectPresentations)} x${event.stacks || 1}${event.duration ? ` (${event.duration}s)` : ''}`,
          'trigger'
        );
        break;
      default:
        if (String(event.type || '').includes('.')) {
          pushProfessionRow(event);
        }

        break;
    }
  }

  for (const event of result?.resolvedEvents || []) {
    if (event.type === 'damage') {
      const isCloneHit = event.source === 'Clone';
      const source = isCloneHit ? 'CLONE HIT' : 'HIT';
      // Preserve the actor or triggering skill on derived-damage rows without
      // splitting their damage-breakdown attribution.
      const triggeredBy = String(event.triggeredBy || '');
      const alliedAttacker = /^Allied Player \d+ Attack$/.test(triggeredBy) ? triggeredBy : '';
      const attacker = alliedAttacker || minionAttackerLabel(event);
      const procTrigger =
        !attacker &&
        event.actorType === 'effect' &&
        triggeredBy &&
        triggeredBy !== event.name &&
        triggeredBy !== event.skillName
          ? `Triggered by ${triggeredBy}`
          : '';
      const attribution = attacker || procTrigger;
      push(
        event.at,
        'damage',
        `${source} ${event.name}${attribution ? ` [${attribution}]` : ''} x${event.hits || 1} -> ${Math.round(Number(event.damage || 0)).toLocaleString()} damage`,
        isCloneHit ? 'resource' : '',
        isCloneHit
      );
    } else if (event.type === 'condition') {
      push(
        event.at,
        'condition',
        `CONDITION ${event.condition} x${event.stacks || 1} (${Number(event.duration || 0).toFixed(2)}s) [${event.skillName}]`,
        'condition'
      );
    }
  }

  return rows
    .sort(
      (left, right) =>
        left.at - right.at || left.order - right.order || left.description.localeCompare(right.description)
    )
    .map(({ order: _order, ...row }) => row);
}

export function renderEventLog(app: ProfessionAppState): void {
  const element = document.getElementById('rotation-event-log');
  const result = app.results;
  if (!element || !app.build.rotation.length || !result) {
    if (element) element.innerHTML = '';
    return;
  }

  const eventLog = simulationEventLogRows(result, app.build, app.profession);
  const hasPhantasmClone = eventLog.some((event) => event.phantasmClone);
  mountEventLog(
    element,
    eventLog.map((event) => ({
      ...event,
      rowClassName: event.phantasmClone ? 'log-phantasm' : ''
    })),
    {
      title: 'Event Log',
      filename: app.adapter?.filenames?.eventLog || 'event-log.csv',
      filters: hasPhantasmClone
        ? [
            {
              id: 'phantasm',
              label: 'Phantasm & Clone only',
              predicate: (event) => Boolean(event.phantasmClone)
            }
          ]
        : []
    }
  );
}
