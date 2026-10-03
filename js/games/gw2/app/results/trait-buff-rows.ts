import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { CatalogEntity } from '#gw2/platform/engine/skills/types.js';
import type { EventLogRow } from '#ui/results/event-log.js';

/** Keep provenance until trait grants have been grouped; the shared renderer only receives display rows. */
export type AttributedEventLogRow = EventLogRow & { readonly event?: SimulationEvent };

/** Name actual recipients when resolution is available, otherwise describe the authored audience. */
function recipients(event: SimulationEvent): string {
  const resolved = event.resolvedAudience;
  if (resolved) {
    const labels = [
      ...(resolved.includesSelf ? ['self'] : []),
      ...(resolved.alliedPlayerCount
        ? [`${resolved.alliedPlayerCount} ${resolved.alliedPlayerCount === 1 ? 'ally' : 'allies'}`]
        : []),
      ...(resolved.includesSummons ? ['summons'] : [])
    ];
    return labels.join(' + ') || 'no recipients';
  }

  const audience = event.audience;
  if (!audience || audience.recipients === 'self') return 'self';
  return `${audience.recipients}${audience.affectsSelf === false ? ' (excluding self)' : ''}`;
}

/** Combine only grants with the same recorded cause, trait, boon, and instant; unrelated procs stay separate. */
export function consolidateTraitBuffRows(
  rows: readonly AttributedEventLogRow[],
  traits: readonly CatalogEntity[]
): EventLogRow[] {
  const names = new Map(traits.map((trait) => [trait.id, trait.name]));
  const groups = new Map<string, AttributedEventLogRow[]>();
  const byOrder = new Map(
    rows.flatMap((row) => (row.event?.eventOrder == null ? [] : [[row.event.eventOrder, row] as const]))
  );
  const children = new Map<string, AttributedEventLogRow[]>();
  for (const row of rows) {
    if (row.parentId) {
      const siblings = children.get(row.parentId) ?? [];
      siblings.push(row);
      children.set(row.parentId, siblings);
    }

    const event = row.event;
    if (event?.type !== 'buff' || event.source !== 'Trait' || event.sourceId == null) continue;
    // Missing causal identity permits attribution, but never a guess at which activation to merge.
    const key = JSON.stringify([event.sourceId, event.kind, event.at, event.parentEventOrder ?? row.id]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const replacements = new Map<AttributedEventLogRow, AttributedEventLogRow>();
  const removed = new Set<AttributedEventLogRow>();
  const redirects = new Map<string, string>();
  for (const group of groups.values()) {
    const first = group[0];
    const event = first.event!;
    const parent = typeof event.parentEventOrder === 'number' ? byOrder.get(event.parentEventOrder) : undefined;
    // Fold an explicitly linked announcement into its grants, retaining details and any non-buff children.
    const absorb =
      parent?.event?.type === 'proc' &&
      parent.event.source === 'Trait' &&
      parent.event.sourceId === event.sourceId &&
      parent.event.at === event.at &&
      parent.id != null &&
      children
        .get(parent.id)
        ?.filter((child) => child.event?.type === 'buff')
        .every((child) => group.includes(child));
    const anchor = absorb ? parent! : first;
    const name = names.get(event.sourceId) ?? event.name ?? String(event.sourceId);
    const effect = first.tag?.label ?? event.kind ?? 'Buff';
    const grants = group.map((row) => {
      const grant = row.event!;
      return `x${grant.stacks ?? 1} · ${recipients(grant)}${grant.duration == null ? '' : ` ${Number(grant.duration.toFixed(3))}s`}`;
    });
    const description = `${name === effect ? name : `${name} → ${effect}`} ${grants.join('; ')}${absorb && parent?.event?.detail ? ` · ${parent.event.detail}` : ''}`;
    replacements.set(anchor, {
      ...anchor,
      description,
      tag: first.tag,
      // Each application remains inspectable even though the default log shows one summary.
      ...(group.length > 1
        ? {
            details: group.map(
              (row, index) =>
                `${effect} ${grants[index]} · simulation time ${row.event!.at}s · event ${row.event!.eventOrder}`
            )
          }
        : {})
    });
    for (const row of group) {
      if (row === anchor) continue;
      removed.add(row);
      if (row.id && anchor.id) redirects.set(row.id, anchor.id);
    }
  }

  return rows
    .filter((row) => !removed.has(row))
    .map((original) => {
      const { event: _event, ...row } = replacements.get(original) ?? original;
      return row.parentId && redirects.has(row.parentId) ? { ...row, parentId: redirects.get(row.parentId) } : row;
    });
}
