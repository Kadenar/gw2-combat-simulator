import {
    PREFIXES, GEAR_SLOTS, RUNE_NAMES, RUNE_GROUPS, FOOD_NAMES, FOOD_GROUPS,
    UTILITY_NAMES, INFUSION_STATS,
    WEAPON_DATA, SIGIL_DATA, SIGIL_NAMES, RELIC_DATA, RELIC_NAMES, getActiveGearSlots,
} from '../data/gear-data.js';
import { GearOptimizer } from '../optimizer/optimizer.js';
import { downloadJson } from '../../../app/build/files.js';
import { escapeHtml as esc } from '../../../platform/ui/html.js';

function clampInt(value, min, max, fallback) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function readInfusionRangeInputs() {
    const out = {};
    document.querySelectorAll('#opt-infusion-ranges .opt-infusion-range-row').forEach(row => {
        const stat = row.dataset.stat;
        if (!stat) return;
        const minInput = row.querySelector('input[data-kind="min"]');
        const maxInput = row.querySelector('input[data-kind="max"]');
        out[stat] = {
            min: minInput?.value ?? '',
            max: maxInput?.value ?? '',
        };
    });
    return out;
}

function enumerateSigilPairs(slot1, slot2) {
    if (!slot1.length && !slot2.length) return [[null, null]];
    if (!slot1.length || !slot2.length) return [];

    const seen = new Set();
    const out = [];
    for (const sigil1 of slot1) {
        for (const sigil2 of slot2) {
            if (sigil1 === sigil2) continue;
            const key = [sigil1, sigil2].sort().join('\u0000');
            if (seen.has(key)) continue;
            seen.add(key);
            out.push([sigil1, sigil2]);
        }
    }
    return out;
}

function enumerateInfusionDistributions(ranges, total) {
    if (!ranges.length) return [[]];

    const normalized = ranges.map(({ stat, min, max }) => {
        const clampedMin = clampInt(min, 0, total, 0);
        const clampedMax = clampInt(max, clampedMin, total, total);
        return { stat, min: clampedMin, max: clampedMax };
    });

    const minSum = normalized.reduce((sum, range) => sum + range.min, 0);
    const maxSum = normalized.reduce((sum, range) => sum + range.max, 0);
    if (total < minSum || total > maxSum) return [];

    const suffixMin = new Array(normalized.length + 1).fill(0);
    const suffixMax = new Array(normalized.length + 1).fill(0);
    for (let i = normalized.length - 1; i >= 0; i--) {
        suffixMin[i] = suffixMin[i + 1] + normalized[i].min;
        suffixMax[i] = suffixMax[i + 1] + normalized[i].max;
    }

    const counts = new Array(normalized.length).fill(0);
    const out = [];
    const recurse = (idx, remaining) => {
        const range = normalized[idx];
        if (idx === normalized.length - 1) {
            if (remaining < range.min || remaining > range.max) return;
            counts[idx] = remaining;
            out.push(
                normalized
                    .map((entry, i) => ({ stat: entry.stat, count: counts[i] }))
                    .filter(entry => entry.count > 0)
            );
            return;
        }

        const nextMin = suffixMin[idx + 1];
        const nextMax = suffixMax[idx + 1];
        const low = Math.max(range.min, remaining - nextMax);
        const high = Math.min(range.max, remaining - nextMin);
        for (let count = low; count <= high; count++) {
            counts[idx] = count;
            recurse(idx + 1, remaining - count);
        }
    };

    recurse(0, total);
    return out;
}

export function initOptimizer(app) {
    app._optimizer = new GearOptimizer({
        skills: app.data.skills,
        skillHits: app.data.skillHits,
        weapons: WEAPON_DATA,
        sigils: SIGIL_DATA,
        relics: RELIC_DATA,
        hitboxSize: app.hitboxSize,
        glyphBoonedElementals: app.glyphBoonedElementals,
        thornsBossAuraOnly: app.thornsBossAuraOnly,
    });
    app._optResults = [];
    app._optRunning = false;
    app._populateOptimizerCheckboxes();
    app._bindOptimizerEvents();
}

export function populateOptimizerCheckboxes(app, { foodDesc, utilityDesc }) {
    const b = app.build;

    const mkGridItem = (name, group, currentVals) => {
        const checked = currentVals.includes(name) ? ' checked' : '';
        const short = name.length > 28 ? name.slice(0, 27) + '…' : name;
        return `<label title="${esc(name)}">
            <input type="checkbox" data-group="${group}" value="${esc(name)}"${checked}>
            ${esc(short)}
        </label>`;
    };

    const makeGrid = (containerId, items, group, currentVals, groups = null) => {
        const el = document.getElementById(containerId);
        if (!el) return;
        if (groups) {
            el.innerHTML = groups.map(g =>
                `<div class="opt-section-label">${esc(g.label)}</div>`
                + g.items.map(name => mkGridItem(name, group, currentVals)).join('')
            ).join('');
        } else {
            el.innerHTML = items.map(name => mkGridItem(name, group, currentVals)).join('');
        }
    };

    const mkConsumableItem = (name, group, currentVals, descFn) => {
        const checked = currentVals.includes(name) ? ' checked' : '';
        const short = name.length > 28 ? name.slice(0, 27) + '…' : name;
        const desc = descFn(name);
        return `<label class="consumable-label" title="${esc(name)}">
            <input type="checkbox" data-group="${group}" value="${esc(name)}"${checked}>
            <span class="opt-consumable-name">${esc(short)}</span>${desc ? `<span class="opt-consumable-desc">${esc(desc)}</span>` : ''}
        </label>`;
    };

    const makeConsumableGrid = (containerId, items, group, currentVals, descFn, groups = null) => {
        const el = document.getElementById(containerId);
        if (!el) return;
        if (groups) {
            el.innerHTML = groups.map(g =>
                `<div class="opt-section-label">${esc(g.label)}</div>`
                + g.items.map(name => mkConsumableItem(name, group, currentVals, descFn)).join('')
            ).join('');
        } else {
            el.innerHTML = items.map(name => mkConsumableItem(name, group, currentVals, descFn)).join('');
        }
    };

    const curPrefix = Object.values(b.gear || {})[0] || PREFIXES[0];
    makeGrid('opt-prefixes', PREFIXES, 'prefix', [curPrefix, "Assassin's"].filter(p => PREFIXES.includes(p)));
    makeGrid('opt-runes', RUNE_NAMES, 'rune', [b.rune].filter(Boolean), RUNE_GROUPS);
    makeGrid('opt-sigils-1', SIGIL_NAMES, 'sigil1', b.sigils?.[0] ? [b.sigils[0]] : []);
    makeGrid('opt-sigils-2', SIGIL_NAMES, 'sigil2', b.sigils?.[1] ? [b.sigils[1]] : []);
    makeGrid('opt-relics', RELIC_NAMES, 'relic', [b.relic].filter(Boolean));
    makeConsumableGrid('opt-food', FOOD_NAMES, 'food', [b.food].filter(Boolean), foodDesc, FOOD_GROUPS);
    makeConsumableGrid('opt-utility', UTILITY_NAMES, 'utility', [b.utility].filter(Boolean), utilityDesc);

    const infEl = document.getElementById('opt-infusions');
    if (infEl) {
        const usedStats = new Set((b.infusions || []).filter(x => x.count > 0).map(x => x.stat));
        infEl.innerHTML = INFUSION_STATS.map(stat => {
            const checked = usedStats.has(stat) ? ' checked' : '';
            return `<label title="${esc(stat)}">
                <input type="checkbox" data-group="infusion" value="${esc(stat)}"${checked}>
                ${esc(stat)}
            </label>`;
        }).join('');
    }

    const curInfTotal = (b.infusions || []).reduce((s, x) => s + (x.count || 0), 0);
    const infTotalEl = document.getElementById('opt-inf-total');
    if (infTotalEl && curInfTotal > 0) infTotalEl.value = curInfTotal;

    enforcePrefixMax();
    renderInfusionRanges(app);
    populateSlotConstraints(app);
}

export function populateSlotConstraints(app) {
    const container = document.getElementById('opt-slot-constraints');
    if (!container) return;
    const current = readSlotConstraints();
    const SLOT_LABELS = {
        Helm: 'Helm', Shoulders: 'Shld', Chest: 'Coat', Gloves: 'Glov',
        Leggins: 'Legs', Boots: 'Boot', Amulet: 'Amul', Ring1: 'Rng1',
        Ring2: 'Rng2', Accessory1: 'Acc1', Accessory2: 'Acc2', Back: 'Back',
        Weapon1: 'Wep1', Weapon2: 'Wep2', Weapon2H: 'Wep(2H)',
    };
    const activeSlots = getActiveGearSlots(app.build.weapons, WEAPON_DATA);
    container.innerHTML = activeSlots.map(slot => {
        const label = SLOT_LABELS[slot] || slot;
        const opts = PREFIXES.map(p => {
            const selected = current[slot] === p ? ' selected' : '';
            return `<option value="${esc(p)}"${selected}>${esc(p)}</option>`;
        }).join('');
        return `<div class="opt-slot-constraint">
            <label>${esc(label)}</label>
            <select data-slot="${esc(slot)}">
                <option value="">Any</option>
                ${opts}
            </select>
        </div>`;
    }).join('');
}

export function readSlotConstraints() {
    const out = {};
    document.querySelectorAll('#opt-slot-constraints select').forEach(sel => {
        if (sel.value) out[sel.dataset.slot] = sel.value;
    });
    return out;
}

export function getActiveSlots(app) {
    return getActiveGearSlots(app.build.weapons, WEAPON_DATA);
}

export function renderInfusionRanges(app) {
    const container = document.getElementById('opt-infusion-ranges');
    if (!container) return;

    const selectedStats = getChecked('opt-infusions');
    const total = clampInt(document.getElementById('opt-inf-total')?.value ?? '18', 0, 18, 18);
    const existing = readInfusionRangeInputs();
    const buildInfusions = new Map((app.build.infusions || []).map(entry => [entry.stat, entry.count || 0]));

    if (!selectedStats.length) {
        container.innerHTML = '<div class="opt-infusion-ranges-empty">No infusion stat types selected.</div>';
        return;
    }

    container.innerHTML = selectedStats.map(stat => {
        const prev = existing[stat] || {};
        const defaultMax = Math.max(buildInfusions.get(stat) || 0, total);
        const min = clampInt(prev.min, 0, total, 0);
        const max = clampInt(prev.max, min, total, Math.min(defaultMax, total));
        return `<div class="opt-infusion-range-row" data-stat="${esc(stat)}">
            <div class="opt-infusion-range-name" title="${esc(stat)}">${esc(stat)}</div>
            <label class="opt-infusion-range-field">
                <span>Min #</span>
                <input
                    type="number"
                    min="0"
                    max="${total}"
                    value="${min}"
                    class="opt-infusion-range-input"
                    data-kind="min"
                >
            </label>
            <label class="opt-infusion-range-field">
                <span>Max #</span>
                <input
                    type="number"
                    min="0"
                    max="${total}"
                    value="${max}"
                    class="opt-infusion-range-input"
                    data-kind="max"
                >
            </label>
        </div>`;
    }).join('');
}

export function readInfusionRanges(stats, total) {
    const current = readInfusionRangeInputs();
    return stats.map(stat => {
        const range = current[stat] || {};
        const min = clampInt(range.min, 0, total, 0);
        const max = clampInt(range.max, min, total, total);
        return { stat, min, max };
    });
}

export function bindOptimizerEvents(app) {
    const groupContainerId = g => ({
        prefix: 'opt-prefixes', rune: 'opt-runes', sigil1: 'opt-sigils-1', sigil2: 'opt-sigils-2',
        relic: 'opt-relics', food: 'opt-food', utility: 'opt-utility',
        infusion: 'opt-infusions',
    }[g]);

    document.querySelectorAll('.opt-selall').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = groupContainerId(btn.dataset.group);
            if (id) document.querySelectorAll(`#${id} input`).forEach(cb => { cb.checked = true; });
            if (btn.dataset.group === 'prefix') enforcePrefixMax();
            if (btn.dataset.group === 'prefix') populateSlotConstraints(app);
            if (btn.dataset.group === 'infusion') renderInfusionRanges(app);
        });
    });
    document.querySelectorAll('.opt-deselall').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = groupContainerId(btn.dataset.group);
            if (id) document.querySelectorAll(`#${id} input`).forEach(cb => { cb.checked = false; });
            if (btn.dataset.group === 'prefix') {
                enforcePrefixMax();
                populateSlotConstraints(app);
            }
            if (btn.dataset.group === 'infusion') renderInfusionRanges(app);
        });
    });

    document.getElementById('opt-prefixes')?.addEventListener('change', () => {
        enforcePrefixMax();
        populateSlotConstraints(app);
    });
    document.getElementById('opt-infusions')?.addEventListener('change', () => renderInfusionRanges(app));
    document.getElementById('opt-inf-total')?.addEventListener('input', () => renderInfusionRanges(app));

    document.getElementById('btn-opt-run')?.addEventListener('click', () => app._runOptimizer());
    document.getElementById('btn-opt-cancel')?.addEventListener('click', () => {
        if (app._optimizer) app._optimizer.cancel();
    });
    document.getElementById('btn-opt-export')?.addEventListener('click', () => app._exportOptimizerResults());
}

export function enforcePrefixMax() {
    const checked = [...document.querySelectorAll('#opt-prefixes input:checked')];
    const MAX = 3;
    document.querySelectorAll('#opt-prefixes label').forEach(lbl => {
        const cb = lbl.querySelector('input');
        if (checked.length >= MAX && !cb.checked) {
            lbl.classList.add('opt-prefix-disabled');
            cb.disabled = true;
        } else {
            lbl.classList.remove('opt-prefix-disabled');
            cb.disabled = false;
        }
    });
}

export function updateOptimizerVisibility(app, show) {
    const sec = document.getElementById('optimizer-section');
    if (!sec) return;
    if (show) {
        sec.classList.remove('hidden');
    } else {
        sec.classList.add('hidden');
        if (app._optRunning && app._optimizer) app._optimizer.cancel();
    }
}

export function getChecked(containerId) {
    return [...document.querySelectorAll(`#${containerId} input:checked`)].map(cb => cb.value);
}

export function infusionComboCount(k, total) {
    if (k <= 1) return 1;
    const n = total + k - 1;
    const r = k - 1;
    let result = 1;
    for (let i = 0; i < r; i++) result = result * (n - i) / (i + 1);
    return Math.round(result);
}

export async function runOptimizer(app) {
    if (app._optRunning) return;

    const infusionStats = getChecked('opt-infusions');
    const infusionTotal = clampInt(document.getElementById('opt-inf-total')?.value ?? '18', 0, 18, 18);
    const infusionRanges = readInfusionRanges(infusionStats, infusionTotal);

    const space = {
        prefixes: getChecked('opt-prefixes'),
        runes: getChecked('opt-runes'),
        sigils1: getChecked('opt-sigils-1'),
        sigils2: getChecked('opt-sigils-2'),
        relics: getChecked('opt-relics'),
        foods: getChecked('opt-food'),
        utilities: getChecked('opt-utility'),
        infusionStats,
        infusionTotal,
        infusionRanges,
    };

    const parseConstraint = id => {
        const v = parseFloat(document.getElementById(id)?.value);
        return isNaN(v) ? null : v;
    };
    const constraints = {
        minBoonDuration: parseConstraint('opt-min-boon-dur'),
        minCritChance: parseConstraint('opt-min-crit'),
        minToughness: parseConstraint('opt-min-tough'),
        minVitality: parseConstraint('opt-min-vit'),
    };

    const slotConstraints = app._readSlotConstraints();

    if (!space.prefixes.length) {
        alert('Select at least one gear prefix.');
        return;
    }

    const sigilPairs = enumerateSigilPairs(space.sigils1, space.sigils2).length;
    if (!sigilPairs) {
        alert('No valid sigil pairs remain. Select at least one candidate for each slot, and duplicate sigils are skipped.');
        return;
    }

    const infCombos = infusionStats.length === 0 ? 1 : enumerateInfusionDistributions(infusionRanges, infusionTotal).length;
    if (!infCombos) {
        alert('Infusion min/max ranges do not allow any distribution matching the selected total.');
        return;
    }

    const combos = Math.max(space.runes.length, 1) * Math.max(space.relics.length, 1)
        * sigilPairs * Math.max(space.foods.length, 1) * Math.max(space.utilities.length, 1)
        * infCombos;

    app._optRunning = true;
    const runBtn = document.getElementById('btn-opt-run');
    const cancelBtn = document.getElementById('btn-opt-cancel');
    const progWrap = document.getElementById('opt-progress-wrap');
    const progFill = document.getElementById('opt-progress-fill');
    const progLabel = document.getElementById('opt-progress-label');
    const exportBtn = document.getElementById('btn-opt-export');
    const resultsEl = document.getElementById('opt-results');

    runBtn.disabled = true;
    cancelBtn.classList.remove('hidden');
    progWrap.classList.remove('hidden');
    exportBtn.classList.add('hidden');
    if (resultsEl) resultsEl.classList.add('hidden');

    try {
        app._optimizer.hitboxSize = app.hitboxSize || 'large';
        app._optimizer.glyphBoonedElementals = !!app.glyphBoonedElementals;
        app._optimizer.thornsBossAuraOnly = !!app.thornsBossAuraOnly;
        app._optimizer.permaField = app.permaField || '';
        const results = await app._optimizer.optimize(
            {
                build: JSON.parse(JSON.stringify(app.build)),
                selectedSkills: Object.values(app.selectedSkills).filter(Boolean),
                rotation: app.sim.rotation,
                space,
                constraints,
                slotConstraints,
                startAtt: app.activeAttunement,
                startAtt2: app.secondaryAttunement,
                evokerElement: app.evokerElement,
                permaBoons: app.permaBoons,
                targetHP: app._getTargetHP(),
            },
            (done, total, top10, statusMsg) => {
                const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
                progFill.style.width = pct.toFixed(1) + '%';
                progLabel.textContent = statusMsg
                    ? statusMsg
                    : `${done.toLocaleString()} / ~${total.toLocaleString()} evals (${pct.toFixed(0)}%)`;
                renderOptimizerResults(app, top10);
            }
        );

        app._optResults = results;
        progFill.style.width = '100%';
        progLabel.textContent = `Done — ${results.length} unique builds found`;
        renderOptimizerResults(app, results);
        if (results.length) {
            exportBtn.classList.remove('hidden');
            if (resultsEl) resultsEl.classList.remove('hidden');
        }
    } catch (err) {
        progLabel.textContent = 'Error: ' + err.message;
    } finally {
        app._optRunning = false;
        runBtn.disabled = false;
        cancelBtn.classList.add('hidden');
    }
}

export function renderOptimizerResults(app, results) {
    const body = document.getElementById('opt-results-body');
    const wrap = document.getElementById('opt-results');
    if (!body || !results.length) return;

    const PFX_ABBR = {
        "Berserker's": 'Bers', "Assassin's": 'Assn', "Harrier's": 'Harr',
        "Viper's": 'Vipr', "Sinister's": 'Sins', "Grieving": 'Grvg',
        "Ritualist's": 'Ritu', "Celestial": 'Cele', "Diviner's": 'Divn',
        "Dragon's": 'Drag', "Marshal's": 'Mrsh', "Plaguedoctor's": 'PlgD',
        "Trailblazer's": 'Trbl', "Seraph's": 'Sera', "Minstrel's": 'Mnst',
        'Rabid': 'Rabid',
    };
    const PFX_CSS = {
        "Berserker's": 'pfx-berserker', "Assassin's": 'pfx-assassin',
        "Harrier's": 'pfx-harrier', "Viper's": 'pfx-viper',
        "Sinister's": 'pfx-sinister', "Grieving": 'pfx-grieving',
        "Ritualist's": 'pfx-ritualist', "Celestial": 'pfx-celestial',
        "Diviner's": 'pfx-diviner', "Dragon's": 'pfx-dragon',
        "Marshal's": 'pfx-marshal', "Plaguedoctor's": 'pfx-plaguedoctor',
        "Trailblazer's": 'pfx-trailblazer', "Seraph's": 'pfx-seraph',
        "Minstrel's": 'pfx-minstrel',
    };

    const slotBadge = (prefix) => {
        const abbr = PFX_ABBR[prefix] || prefix?.slice(0, 4) || '?';
        const cls = PFX_CSS[prefix] || 'pfx-default';
        return `<span class="opt-slot-badge ${cls}" title="${esc(prefix || '')}">${esc(abbr)}</span>`;
    };

    const shortName = (s) => {
        if (!s) return '—';
        const trimmed = s.replace(/^Bowl of |^Plate of |^Superior |^Furious |^Toxic |^Potent /i, '');
        return trimmed.length > 14 ? trimmed.slice(0, 13) + '…' : trimmed;
    };
    const infLabel = (infusions) => {
        if (!infusions?.length) return '—';
        return infusions.map(x => `${x.count}×${x.stat.slice(0, 3)}`).join('+');
    };

    body.innerHTML = results.map((r, i) => {
        const sigilStr = [r.sigil1, r.sigil2].filter(Boolean).join('+') || '—';
        const dpsStr = r.dps > 0 ? Math.round(r.dps).toLocaleString() : (r.rawDps > 0 ? Math.round(r.rawDps).toLocaleString() + '*' : '—');

        const mhWeapon = app.build.weapons?.[0] || '';
        const is2H = WEAPON_DATA[mhWeapon]?.wielding === '2h';
        const slotCells = GEAR_SLOTS.map(slot => {
            if (is2H && slot === 'Weapon2') return '<span class="opt-slot-badge pfx-default">—</span>';
            return slotBadge(r.gear[slot]);
        }).join('');

        return `<div class="opt-result-row" data-idx="${i}">
            <span class="opt-rank">${i + 1}</span>
            <span class="opt-dps">${dpsStr}</span>
            ${slotCells}
            <span class="opt-cell" title="${esc(r.rune || '')}">${esc(shortName(r.rune))}</span>
            <span class="opt-cell" title="${esc(r.relic || '')}">${esc(shortName(r.relic))}</span>
            <span class="opt-cell" title="${esc(sigilStr)}">${esc(sigilStr)}</span>
            <span class="opt-cell" title="${esc(r.food || '')}">${esc(shortName(r.food))}</span>
            <span class="opt-cell" title="${esc(r.utility || '')}">${esc(shortName(r.utility))}</span>
            <span class="opt-cell" title="${esc(infLabel(r.infusions))}">${esc(infLabel(r.infusions))}</span>
            <button class="opt-apply-btn" data-idx="${i}">Apply</button>
        </div>`;
    }).join('');

    wrap.classList.remove('hidden');

    body.querySelectorAll('.opt-apply-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            applyOptimizerResult(app, app._optResults[idx]);
        });
    });
}

export function applyOptimizerResult(app, r) {
    if (!r) return;
    app.build.gear = { ...r.gear };
    if (r.rune) app.build.rune = r.rune;
    if (r.relic) app.build.relic = r.relic;
    if (r.sigil1) app.build.sigils = [r.sigil1, r.sigil2].filter(Boolean);
    if (r.food) app.build.food = r.food;
    if (r.utility) app.build.utility = r.utility;
    if (r.infusions) app.build.infusions = r.infusions.map(x => ({ ...x }));
    app._onBuildChange();
    app.renderGear();
}

export function exportOptimizerResults(app) {
    if (!app._optResults?.length) return;
    const data = app._optResults.map((r, i) => ({
        rank: i + 1,
        dps: Math.round(r.dps),
        gear: r.gear,
        rune: r.rune || null,
        relic: r.relic || null,
        sigils: [r.sigil1, r.sigil2].filter(Boolean),
        food: r.food || null,
        utility: r.utility || null,
        infusions: r.infusions || null,
    }));
    downloadJson('gw2-optimized-builds.json', data);
}
