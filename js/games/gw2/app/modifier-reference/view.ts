/** Keep the reference a compact list, with filtering on the same rule's damage type and stacking behavior. */
import type { ModifierReferenceEntry } from '#gw2/app/modifier-reference/model.js';
import type { TooltipFact } from '#gw2/platform/skills/types.js';
import { escapeHtml as esc } from '#ui/shared/html.js';

export interface ReferenceFilters {
  readonly profession: string;
  readonly specialization: string;
  readonly target: string;
  readonly bucket: string;
  readonly q: string;
}

export function filterModifiers(
  entries: readonly ModifierReferenceEntry[],
  filters: ReferenceFilters
): readonly ModifierReferenceEntry[] {
  const words = filters.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    if (filters.profession && entry.profession !== filters.profession) return false;

    if (filters.specialization && !entry.specializations.includes(filters.specialization)) return false;

    if (
      !entry.rules.some(
        (rule) =>
          (!filters.target || rule.targets.includes(filters.target)) &&
          (!filters.bucket || rule.bucket === filters.bucket)
      )
    )
      return false;

    const text =
      `${entry.name} ${entry.professionName} ${entry.specializations.join(' ')} ${entry.group} ${entry.skills.map((skill) => skill.name).join(' ')}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** Expanded information reuses the same formatted facts as the simulator's trait and skill cards. */
function factsHtml(facts: readonly TooltipFact[]): string {
  return `<dl class="modifier-reference-facts">${facts.map((fact) => `<div><dt>${fact.prefix ? `${esc(fact.prefix.name)} · ` : ''}${esc(fact.name)}${fact.applications && fact.applications > 1 ? ` ×${fact.applications}` : ''}</dt><dd>${fact.stacks ? `${fact.stacks} stacks · ` : ''}${esc(fact.detail)}</dd></div>`).join('')}</dl>`;
}

function referenceEntryHtml(entry: ModifierReferenceEntry): string {
  // Keep each damage type beside its bucket so mixed rules remain unambiguous.
  const behaviors = [
    ...new Set(
      entry.rules.flatMap((rule) =>
        rule.targets.map((target) => `${target} · ${rule.bucket === 'additive' ? 'Additive' : 'Multiplicative'}`)
      )
    )
  ];
  return `<details class="modifier-reference-entry">
    <summary><span class="modifier-reference-name"><span class="modifier-reference-icons">${entry.icons.map((icon) => `<img src="${esc(icon)}" alt="" loading="lazy" width="28" height="28">`).join('')}</span><span><strong>${esc(entry.name)}</strong>${entry.source === 'trait' ? '' : `<small>${esc(entry.specializations.join(' / '))}</small>`}</span></span>
      <span class="modifier-reference-tags">${behaviors.map((text) => `<span>${esc(text)}</span>`).join('')}</span>
    </summary>
    <div class="modifier-reference-detail">
      ${entry.skills.length > 1 ? `<p class="modifier-reference-sources">Sources: ${esc([...new Set(entry.skills.map((skill) => skill.name))].join(', '))}</p>` : ''}
      ${entry.tooltip.description ? `<p>${esc(entry.tooltip.description)}</p>` : ''}
      <dl class="modifier-reference-rules">${entry.rules.map((rule) => `<div><dt>${rule.qualifier ? `${esc(rule.qualifier)} · ` : ''}${esc(rule.targets.join(' / '))} damage</dt><dd>${rule.value ? `${esc(rule.value)} · ` : ''}${rule.bucket === 'additive' ? 'Additive' : 'Multiplicative'}</dd></div>`).join('')}</dl>
      ${factsHtml(entry.tooltip.facts)}
      ${(entry.tooltip.factTabs ?? []).map((tab) => `<h4>${esc(tab.label)}</h4>${factsHtml(tab.facts)}`).join('')}
    </div>
  </details>`;
}

/** Group the filtered entries without changing the alphabetical order within each group. */
function groupEntries(
  entries: readonly ModifierReferenceEntry[],
  key: 'professionName' | 'group'
): Map<string, ModifierReferenceEntry[]> {
  const groups = new Map<string, ModifierReferenceEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry[key]) ?? [];
    group.push(entry);
    groups.set(entry[key], group);
  }

  return groups;
}

/** Reserve list rows with the same shimmer and reduced-motion behavior as modifier contributions. */
export function referenceLoadingHtml(): string {
  return `<div class="modifier-reference-loading" role="status" aria-label="Loading modifiers">
    <div class="contrib-loading-skeleton" aria-hidden="true">${Array.from({ length: 6 }, () => '<div class="contrib-loading-row"><span></span><span></span><span></span></div>').join('')}</div>
  </div>`;
}

/** Profession headers appear in the all-professions view; trait lines and skill groups remain visible in either view. */
export function referenceListHtml(entries: readonly ModifierReferenceEntry[], showProfessions: boolean): string {
  if (!entries.length) return '<p class="modifier-reference-empty">No modifiers match these filters.</p>';

  const professions = groupEntries(entries, 'professionName');
  const groupOrder = { trait: 0, utility: 1, weapon: 2, mechanic: 3 };
  return [...professions]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, members]) => {
      const profession = members[0].profession;
      const groups = [...groupEntries(members, 'group')].sort(
        ([a, left], [b, right]) => groupOrder[left[0].source] - groupOrder[right[0].source] || a.localeCompare(b)
      );
      const heading = showProfessions ? 'h3' : 'h2';
      return `<section class="modifier-reference-profession" aria-label="${esc(name)}">
      ${showProfessions ? `<h2 class="modifier-reference-profession-heading">${esc(name)}</h2>` : ''}
      ${groups
        .map(
          (
            [group, rows],
            index
          ) => `<section class="modifier-reference-group" aria-labelledby="modifier-group-${esc(profession)}-${index}">
        <${heading} id="modifier-group-${esc(profession)}-${index}" class="modifier-reference-group-heading">${esc(group)}</${heading}>
        <div class="modifier-reference-rows">${rows.map(referenceEntryHtml).join('')}</div>
      </section>`
        )
        .join('')}
    </section>`;
    })
    .join('');
}
