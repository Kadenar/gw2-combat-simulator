/** Load profession references on demand and keep search/filter URLs shareable without starting a simulation. */
import { createModifierReference, type ModifierReferenceEntry } from '#gw2/app/modifier-reference/model.js';
import {
  filterModifiers,
  referenceListHtml,
  referenceLoadingHtml,
  type ReferenceFilters
} from '#gw2/app/modifier-reference/view.js';
import type { Gw2AppAdapter } from '#gw2/app/types.js';
import { professionRegistry } from '#gw2/profession-registry.js';
import { escapeHtml as esc } from '#ui/shared/html.js';

const mounted = new WeakMap<HTMLElement, Promise<void>>();
interface ReferenceOptions {
  readonly embedded?: boolean;
  readonly profession?: string;
}

/** Keep filters and open rows mounted when switching workspaces; embedded filters never overwrite build URLs. */
export function mountModifierReference(host: HTMLElement, options: ReferenceOptions = {}): Promise<void> {
  const existing = mounted.get(host);

  if (existing) return existing;

  const mounting = initializeReference(host, options);
  mounted.set(host, mounting);
  return mounting;
}

async function initializeReference(host: HTMLElement, options: ReferenceOptions): Promise<void> {
  host.innerHTML = `<fieldset class="modifier-reference-filters" aria-label="Filter modifiers" disabled>
      <label class="filter-field modifier-reference-search">Search<input name="q" type="search" placeholder="Modifier name…" autocomplete="off"></label>
      <label class="filter-field">Profession<select name="profession"><option value="">All professions</option>${professionRegistry.map((entry) => `<option value="${esc(entry.id)}">${esc(entry.name)}</option>`).join('')}</select></label>
      <label class="filter-field">Specialization / trait line<select name="specialization"><option value="">All specializations</option></select></label>
      <label class="filter-field">Damage type<select name="target"><option value="">All damage</option><option>Strike</option><option>Condition</option></select></label>
      <label class="filter-field">Stacking<select name="bucket"><option value="">All stacking</option><option value="additive">Additive</option><option value="multiplier">Multiplicative</option></select></label>
      <label class="filter-field">Balance version<select name="patch"><option value="current">Live</option></select></label>
      <button type="button" class="btn" data-reference-reset>Reset filters</button>
    </fieldset>
    <p class="modifier-reference-status" role="status" aria-live="polite"></p>
    <div class="modifier-reference-errors" role="alert" hidden></div>
    <div class="modifier-reference-list" aria-busy="true"></div>`;
  const controls = host.querySelector<HTMLFieldSetElement>('fieldset')!;
  const status = host.querySelector<HTMLElement>('[role="status"]')!;
  const errors = host.querySelector<HTMLElement>('[role="alert"]')!;
  const list = host.querySelector<HTMLElement>('.modifier-reference-list')!;
  const control = (name: string) => host.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;

  if (options.embedded) control('profession').value = options.profession ?? '';

  const adapters = new Map<string, Gw2AppAdapter>();
  let entries: readonly ModifierReferenceEntry[] = [];
  let loadErrors: string[] = [];
  const filterNames = ['profession', 'specialization', 'target', 'bucket', 'q'] as const;
  const filters = (): ReferenceFilters => ({
    profession: control('profession').value,
    specialization: control('specialization').value,
    target: control('target').value,
    bucket: control('bucket').value,
    q: control('q').value
  });

  function updateSpecializations(selected: string): void {
    const profession = control('profession').value;
    const names = [
      ...new Set(
        entries
          .filter((entry) => !profession || entry.profession === profession)
          .flatMap((entry) => entry.specializations)
      )
    ].sort();
    control('specialization').innerHTML =
      `<option value="">All specializations</option>${names.map((name) => `<option>${esc(name)}</option>`).join('')}`;
    control('specialization').value = names.includes(selected) ? selected : '';
  }

  function render(): void {
    const matches = filterModifiers(entries, filters());
    list.innerHTML = referenceListHtml(matches, !control('profession').value);
    status.textContent = `${matches.length} ${matches.length === 1 ? 'modifier' : 'modifiers'}${loadErrors.length ? ' · Some professions could not be loaded' : ''}`;
    list.setAttribute('aria-busy', 'false');
  }

  function rebuild(): void {
    const patchId = control('patch').value;
    const failures = [...loadErrors];
    entries = [...adapters.values()]
      .flatMap((adapter) => {
        const { profession } = adapter;
        try {
          return createModifierReference(adapter, profession.resolvePatch({ id: patchId }));
        } catch (error) {
          console.error(`Unable to load ${profession.name} modifiers`, error);
          failures.push(profession.name);
          return [];
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name) || a.professionName.localeCompare(b.professionName));
    errors.hidden = !failures.length;
    errors.innerHTML = failures.length
      ? `Could not load modifiers for ${esc(failures.join(', '))}. <button type="button" class="btn" data-reference-retry>Retry</button>`
      : '';
  }

  function readLocation(): void {
    const query = new URLSearchParams(location.search);
    for (const name of filterNames) control(name).value = query.get(name) ?? '';
    const patch = control('patch') as HTMLSelectElement;
    const patchId = query.get('patch') ?? 'current';

    // A stale shared version must not silently show Live values under the requested version's URL.
    if (![...patch.options].some((option) => option.value === patchId))
      patch.add(new Option(`Unavailable version: ${patchId}`, patchId));

    patch.value = patchId;
    rebuild();
    updateSpecializations(query.get('specialization') ?? '');
    render();
  }

  function writeLocation(): void {
    if (options.embedded) return;

    const url = new URL(location.href);
    for (const [name, value] of Object.entries({ ...filters(), patch: control('patch').value })) {
      if (value) url.searchParams.set(name, value);
      else url.searchParams.delete(name);
    }

    url.hash = '';
    history.replaceState(null, '', url);
  }

  async function load(): Promise<void> {
    const selection = { ...filters(), patch: control('patch').value };
    controls.disabled = true;
    list.setAttribute('aria-busy', 'true');
    status.textContent = '';
    list.innerHTML = referenceLoadingHtml();
    loadErrors = [];
    const pending = professionRegistry.filter((entry) => !adapters.has(entry.id));
    const results = await Promise.allSettled(pending.map((entry) => entry.loadAppAdapter()));
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') adapters.set(pending[index].id, result.value);
      else {
        console.error(`Unable to load ${pending[index].name}`, result.reason);
        loadErrors.push(pending[index].name);
      }
    });
    const patches = new Map(
      [...adapters.values()].flatMap(({ profession }) =>
        profession.preview ? [[profession.preview.id, profession.preview.label] as const] : []
      )
    );
    control('patch').innerHTML =
      `<option value="current">Live</option>${[...patches].map(([id, label]) => `<option value="${esc(id)}">${esc(label)}</option>`).join('')}`;
    controls.disabled = false;

    if (options.embedded) {
      control('patch').value = selection.patch;
      rebuild();
      updateSpecializations(selection.specialization);
      render();
    } else readLocation();
  }

  controls.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement;

    if (input.name === 'patch') rebuild();

    if (input.name === 'profession' || input.name === 'patch') updateSpecializations('');

    writeLocation();
    render();
  });
  host.addEventListener('click', (event) => {
    const target = event.target as Element;

    if (target.closest('[data-reference-retry]')) void load();

    if (target.closest('[data-reference-reset]')) {
      for (const name of filterNames) control(name).value = '';
      updateSpecializations('');
      writeLocation();
      render();
    }
  });

  if (!options.embedded) window.addEventListener('popstate', readLocation);

  await load();
}
