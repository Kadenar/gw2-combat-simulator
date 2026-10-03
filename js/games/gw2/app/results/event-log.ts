/** Maps simulation events to display rows and mounts the rotation event-log view. */
import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import { EVENT_LOG_ORDER, mountEventLog, normalizeEventLogDescriptor } from '#ui/results/event-log.js';
import type { EventLogRow } from '#ui/results/event-log.js';
import type { ProfessionAppContract, ProfessionAppState } from '#gw2/app/types.js';
import { professionPlanningState } from '#gw2/app/rotation/context.js';
import { effectName } from '#gw2/app/results/model.js';
import { resultCombatReferenceMs } from '#gw2/app/shared/result-clock.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import { downloadJson } from '#gw2/app/import-export/files.js';
import { damageDebugPayload } from '#gw2/app/results/damage-debug.js';
import { consolidateTraitBuffRows } from '#gw2/app/results/trait-buff-rows.js';
import type { AttributedEventLogRow } from '#gw2/app/results/trait-buff-rows.js';
import {
  CAST_LINK,
  ENTITY_SOURCE,
  deriveEventLogOwnership,
  eventLogSource,
  minionAttackerLabel
} from '#gw2/app/results/event-ownership.js';

/** Rows keep their source event until ownership is resolved; END rows borrow their cast's event. */
type OrderedEventLogRow = EventLogRow & {
  readonly order: number;
  readonly activationOrder: number;
  readonly event?: SimulationEvent;
  readonly castEnd?: boolean;
};

/** Show recorded formula inputs at full clock precision; the log's activation grouping is not an execution trace. */
function damageCalculationDetails(event: SimulationEvent): string[] {
  const calculation = event.damageCalculation!;
  return [
    `Simulation time: ${event.at.toFixed(6)}s; phase: ${calculation.phase}`,
    `Target health before: ${calculation.targetHealthBefore ?? 'unbounded'}; fraction: ${calculation.targetHealthFractionBefore ?? 'unbounded'}`,
    `Power: ${calculation.power}`,
    ...(calculation.precision == null ? [] : [`Precision: ${calculation.precision}`]),
    ...(calculation.ferocity == null ? [] : [`Ferocity: ${calculation.ferocity}`]),
    ...(event.coefficient == null ? [] : [`Authored coefficient: ${event.coefficient}`]),
    `Coefficient multiplier: ${calculation.coefficientMultiplier}`,
    ...(event.resolvedWeaponStrength == null
      ? []
      : [`Weapon strength: ${event.resolvedWeaponStrength} (${event.weaponStrengthProfileId})`]),
    ...(event.activationId == null ? [] : [`Activation: ${event.activationId}`]),
    `Base damage: ${calculation.baseDamage}`,
    `Critical chance: ${event.criticalChance}; critical multiplier: ${calculation.criticalMultiplier}`,
    `Outgoing multiplier: ${calculation.outgoingMultiplier}`,
    `Unrounded damage: ${calculation.unroundedDamage}; rounding: ${calculation.rounding}; damage: ${event.damage}`
  ];
}

export function simulationEventLogRows(
  result: Gw2SimulationResult | null | undefined,
  build: Gw2CanonicalBuild | null = null,
  profession: ProfessionAppContract | null = null
): EventLogRow[] {
  const rows: OrderedEventLogRow[] = [];
  // At equal times, finish each activation's effects and END before the next CAST,
  // while keeping instant casts before their own END and timestamps authoritative.
  const eventOrders = new Map((result?.events || []).map((event, index) => [event, event.eventOrder ?? index]));
  const activationOrders = new Map(
    [...eventOrders].flatMap(([event, order]) =>
      event.type === 'action' && event.activationId ? [[event.activationId, order] as const] : []
    )
  );
  const activationOrder = (event: SimulationEvent): number =>
    event.type === 'combat_start'
      ? -1
      : (activationOrders.get(event.activationId || '') ??
        event.eventOrder ??
        eventOrders.get(event) ??
        eventOrders.size);
  const professionUi = profession?.ui;
  const displayReferenceSeconds = resultCombatReferenceMs(result) / 1000;
  const planningState = professionPlanningState(result);
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
    planningState.resourceDefinition && typeof planningState.resourceDefinition === 'object'
      ? planningState.resourceDefinition
      : {};
  const maximumResource = Number(resourceDefinition.maximum || 0);
  const push = (
    event: SimulationEvent,
    type: string,
    description: string,
    className = '',
    at: unknown = event.at
  ): void => {
    const displayAt = Number(at || 0) - displayReferenceSeconds;
    rows.push({
      at: Math.abs(displayAt) < 1e-12 ? 0 : displayAt,
      type,
      description,
      ...(type === 'damage' && event.damageCalculation ? { details: damageCalculationDetails(event) } : {}),
      className,
      activationOrder: activationOrder(event),
      order: EVENT_LOG_ORDER[type] ?? 80,
      event,
      ...(type === 'cast_end' ? { castEnd: true } : {})
    });
  };

  // Shared events a slice does not present keep their generic fallback row instead of a diagnostic.
  const pushProfessionRow = (event: SimulationEvent, fallback?: () => void): void => {
    const normalized = normalizeEventLogDescriptor(
      professionUi?.eventLogRow?.(
        {
          result,
          build,
          profession,
          specialization
        },
        event
      )
    );
    if (normalized === null) return;
    if (normalized) {
      const displayAt = Number(event.at || 0) - displayReferenceSeconds;
      rows.push({
        at: Math.abs(displayAt) < 1e-12 ? 0 : displayAt,
        ...normalized,
        activationOrder: activationOrder(event),
        event
      });
      return;
    }

    if (fallback) {
      fallback();
      return;
    }

    const message = `UNPRESENTED CUSTOM EVENT ${event.type}`;
    globalThis.console?.warn?.(message, event);
    push(event, 'diagnostic', message, 'diagnostic');
  };

  for (const event of result?.events || []) {
    if (event.type === 'damage' || event.type === 'condition') continue;
    switch (event.type) {
      case 'gw2.transition-lockout':
        // Recovery is a scheduling fact with no combat effect, presented separately from skill casts.
        push(
          event,
          'trigger',
          `TRANSITION DELAY ${event.skillName || event.kind} (${Math.round(Number(event.duration) * 1000)}ms)`,
          'trigger'
        );
        break;
      case 'combat_start':
        push(event, event.type, 'COMBAT START', 'trigger');
        break;
      case 'action': {
        const durationMs = Math.max(0, Math.round((Number(event.endsAt || event.at) - Number(event.at || 0)) * 1000));
        push(event, 'cast', `CAST ${event.name} (${durationMs}ms)`, 'cast');
        push(event, 'cast_end', `END ${event.name}`, '', event.endsAt);
        break;
      }

      case 'resource': {
        // Profession resource snapshots may have no delta; let their presenter explain the actual state.
        pushProfessionRow(event, () => {
          const amount = Number(event.amount || 0);
          const resource = String(event.resource || 'resource');
          const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;
          const reason = event.reason ? ` [${event.reason}]` : '';
          const created = (Array.isArray(event.created) ? event.created : [])
            .map((rawClone: unknown) => {
              const clone = rawClone && typeof rawClone === 'object' ? (rawClone as UnvalidatedFields) : {};
              return `Clone #${String(clone.id ?? '')}${clone.weapon ? ` [${String(clone.weapon)}]` : ''}`;
            })
            .join(', ');
          if (amount > 0) {
            push(
              event,
              event.type,
              `${singular.toUpperCase()} SPAWNED x${amount} -> ${event.value}/${maximumResource}${reason}${created ? ` (${created})` : ''}`,
              'resource'
            );
          } else {
            push(
              event,
              event.type,
              `${resource.toUpperCase()} SPENT x${Math.abs(amount)} -> ${event.value}/${maximumResource}${reason}`,
              'resource'
            );
          }
        });
        break;
      }

      case 'marker':
        push(event, event.type, `EVENT ${event.name}${event.detail ? ` - ${event.detail}` : ''}`, 'trigger');
        break;
      case 'proc':
        push(
          event,
          event.type,
          `${String(event.procType || 'effect').toUpperCase()} ${event.name}${event.sourceSkill ? ` [${event.sourceSkill}]` : ''}${event.detail ? ` - ${event.detail}` : ''}`,
          event.procType || 'trigger'
        );
        break;
      case 'weapon_set':
        // Slices may name their own bar transitions (tomes, forges); ordinary swaps keep the generic row.
        pushProfessionRow(event, () => push(event, 'trigger', `WEAPON SET ${event.weaponSet}`, 'trigger'));
        break;
      case 'control':
        push(event, 'trigger', `CONTROL ${event.skillName}`, 'trigger');
        break;
      case 'peitha':
        if (!build || build.relic === 'Peitha') {
          // Show the skill-authored travel so the trigger row explains when its Torment lands.
          push(
            event,
            'trigger',
            `PEITHA TRIGGER ${event.skillName} (impact +${Number(event.peithaImpactDelayMs)}ms)`,
            'trigger'
          );
        }

        break;
      case 'buff':
        // Let professions hide automatic bookkeeping grants without removing them from the simulation.
        pushProfessionRow(event, () =>
          push(
            event,
            'trigger',
            `BUFF ${effectName(event.kind, event, effectPresentations)} x${event.stacks || 1}${event.duration ? ` (${Number(Number(event.duration).toFixed(3))}s)` : ''}`,
            'trigger'
          )
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
        event,
        'damage',
        `${source} ${event.name}${attribution ? ` [${attribution}]` : ''} x${event.hits || 1} -> ${Math.round(Number(event.damage || 0)).toLocaleString()} damage`,
        isCloneHit ? 'resource' : ''
      );
    } else if (event.type === 'condition') {
      // Preserve milliseconds for condition durations, matching buff durations.
      push(
        event,
        'condition',
        `CONDITION ${event.condition} x${event.stacks || 1} (${Number(event.duration || 0).toFixed(3)}s) [${event.skillName}]`,
        'condition'
      );
    }
  }

  // Resolve causal ownership once every visible row exists, so parent links can skip events the log hides.
  const shown = [...new Set(rows.flatMap((row) => (row.event && !row.castEnd ? [row.event] : [])))];
  const { owners, entities } = deriveEventLogOwnership(shown, [
    ...(result?.events || []),
    ...(result?.resolvedEvents || [])
  ]);
  for (const entity of entities) {
    const displayAt = Number(entity.firstEvent.at || 0) - displayReferenceSeconds;
    rows.push({
      at: Math.abs(displayAt) < 1e-12 ? 0 : displayAt,
      type: 'entity',
      description: entity.label,
      className: 'entity',
      activationOrder: activationOrder(entity.firstEvent),
      order: EVENT_LOG_ORDER.entity,
      id: entity.id,
      parentId: entity.parentId,
      parentLink: entity.parentLink,
      source: ENTITY_SOURCE,
      layout: 'tree'
    });
  }

  let ordinal = 0;
  const attributedRows = rows
    .sort(
      (left, right) => left.at - right.at || left.activationOrder - right.activationOrder || left.order - right.order
    )
    .map(({ order: _order, activationOrder: _activationOrder, event, castEnd, ...row }): AttributedEventLogRow => {
      const owner = event ? owners.get(event) : undefined;
      if (!event || !owner) return row;
      const source = eventLogSource(event);
      // END markers fold into their cast in the tree but stay linked so the chronological layout names the owner.
      if (castEnd)
        return { ...row, parentId: owner.id, parentLink: CAST_LINK, ...(source ? { source } : {}), layout: 'flat' };
      return {
        ...row,
        event,
        id: owner.id,
        ...(owner.parentId ? { parentId: owner.parentId, parentLink: owner.parentLink } : {}),
        ...(owner.orphan ? { orphan: true } : {}),
        ...(source ? { source } : {}),
        // Casts carry their number and duration; hits, boons, and conditions feed the cast's summary.
        ...(event.type === 'action'
          ? { ordinal: ++ordinal, span: Math.max(0, Number(event.endsAt ?? event.at) - Number(event.at || 0)) }
          : {}),
        ...(event.type === 'damage' ? { metric: Number(event.damage || 0) } : {}),
        ...(event.type === 'buff'
          ? { tag: { label: effectName(event.kind, event, effectPresentations), className: 'trigger' } }
          : {}),
        ...(event.type === 'condition' ? { tag: { label: String(event.condition), className: 'condition' } } : {})
      };
    });
  return consolidateTraitBuffRows(attributedRows, profession?.catalog?.traits ?? []);
}

export function renderEventLog(app: ProfessionAppState): void {
  const element = document.getElementById('rotation-event-log');
  const result = app.results;
  if (!element || !app.build.rotation.length || !result) {
    if (element) element.innerHTML = '';
    return;
  }

  mountEventLog(element, simulationEventLogRows(result, app.build, app.profession), {
    title: 'Event Log',
    filename: app.adapter?.filenames?.eventLog || 'event-log.csv',
    metricUnit: ['hit', 'hits']
  });
  // Keep GW2 debug controls beside the log while the shared renderer remains game-independent.
  const controls = element.querySelector('.log-controls');
  if (!controls) return;
  const label = document.createElement('label');
  label.className = 'log-filter-label';
  label.title = 'Rerun with the same seed and expand hits to inspect their calculations. Resets on reload.';
  const capture = document.createElement('input');
  capture.type = 'checkbox';
  capture.checked = app.damageDiagnostics;
  capture.onchange = () => app.setDamageDiagnostics(capture.checked);
  label.append(capture, 'Capture damage calculations');
  controls.append(label);
  // Reuse the log's single download control; the shared CSV handler remains active when capture is off.
  if (!app.damageDiagnostics) return;
  const download = element.querySelector<HTMLButtonElement>('[data-role="event-log-download"]');
  if (!download) return;
  download.textContent = 'Download debug JSON';
  const canDownload = () =>
    app.damageDiagnostics &&
    app.simulationStatus === 'idle' &&
    app.resultRevision === app.buildRevision &&
    app.results === result &&
    Boolean(result.debugInputs);
  download.disabled = !canDownload();
  download.onclick = () => {
    // Recheck freshness at click time because an edit can start while these controls are still visible.
    if (!canDownload()) return;
    downloadJson(`${app.contentId}-damage-debug.json`, damageDebugPayload(result));
  };
}
