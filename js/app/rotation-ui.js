import { ammoDisplayView } from '../platform/ui/ammo-display.js';
import {
    resourceDisplayViews,
} from '../platform/ui/resource-display.js';
import {
    bindPaletteInteractions,
    paletteGroupHtml,
    paletteView,
    virtualPaletteSkillHtml,
} from '../platform/ui/palette.js';
import {
    eventLogCsv,
    mountEventLog,
} from '../platform/ui/event-log.js';
import {
    skillBreakdownRows as transformSkillBreakdownRows,
} from '../platform/ui/result-tables.js';
import {
    bindTimelineInteractions,
    clearTimelineDropIndicators,
    eventTimelineMarkers,
    formatConcurrentTimelineBadge,
    formatInterruptTimelineBadge,
    formatTimelineCastDetails,
    formatTimelineSkillTooltip,
    moveRotationEntry,
    timelineSkillCastOrdinals,
    updateRotationEntry,
    timelineRows,
} from '../platform/ui/timeline.js';
import {
    resultSummaryMetrics as transformResultSummaryMetrics,
    targetHealthBreakpointSnapshots,
} from '../platform/ui/result-transform.js';
import {
    buildChartSeries as buildSharedChartSeries,
    chartValueAt,
} from '../platform/ui/charts.js';
import {
    mountRotationResults,
    SKILL_COLS,
} from '../platform/ui/rotation-results.js';
import { escapeHtml as esc, gw2ApiText } from '../platform/ui/html.js';
import {
    NOURISHMENT_ICON,
    RELIC_DATA,
    SIGIL_DATA,
} from '../platform/gw2/gear-data.js';

const CONCURRENT_OFFSET_MS = 100;
const PLACEHOLDER_ICON = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23232632"/%3E%3Cpath d="M17 46L32 13l15 33z" fill="%23a38ad5"/%3E%3C/svg%3E';
const COMBAT_START_ICON = 'https://wiki.guildwars2.com/images/e/e9/Call_Target.png';
const WAIT_ICON = 'https://wiki.guildwars2.com/images/8/83/%22sipcoffee%22_Emote_Tome.png';
const ACTION_ICONS = {
    'Dodge / Mirage Cloak': 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    'Swap Weapons': 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    'Continuum Shift': 'https://wiki.guildwars2.com/images/d/d7/Continuum_Shift.png',
};
const WEAPON_SET_REFRESH_SKILLS = new Set([
    "Reaper's Shroud",
    "Exit Reaper's Shroud",
    'Harbinger Shroud',
    'Exit Harbinger Shroud',
    'Enter Radiant Forge',
    'Exit Radiant Forge',
]);
const RESULT_PROC_NAMES = {
    'Phantasmal Blade': 'Phantasmal Blades',
    'Cascading Corruption': 'Meltdown',
};
const MODIFIER_EFFECT_ICONS = {
    Might: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Might.png',
    Fury: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Fury.png',
    Vulnerability: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Vulnerability.png',
};
const PALETTE_ACTION_ORDER = new Map([
    ['Dodge / Mirage Cloak', 0],
    ['Swap Weapons', 1],
]);
const EFFECT_COLORS = {
    Bleeding: '#d84b4b',
    Burning: '#f28b3c',
    Confusion: '#b874e8',
    Poisoned: '#62b565',
    Torment: '#a96bd3',
    'Compounding Power': '#cfb5ff',
    'Phantom Pain': '#df79bd',
    'Illusionary Membrane': '#6ec9d8',
    'Deadly Blades': '#e38a8a',
    'Altered Chord': '#80bce8',
    "Fencer's Finesse": '#e1c070',
    'Mirage Cloak': '#d6b46b',
    Alacrity: '#9069d8',
    Protection: '#4f9ec2',
    Resolution: '#d48f45',
    Vigor: '#78bd45',
    Might: '#d9a441',
    Fury: '#d65e5e',
    Regeneration: '#5ebc72',
    Swiftness: '#62a7cb',
    Aegis: '#d9b85f',
};
const EFFECT_NAMES = {
    compounding: 'Compounding Power',
    'phantom-pain': 'Phantom Pain',
    'illusionary-membrane': 'Illusionary Membrane',
    'deadly-blades': 'Deadly Blades',
    'altered-chord': 'Altered Chord',
    fencer: "Fencer's Finesse",
    'mirage-cloak': 'Mirage Cloak',
    alacrity: 'Alacrity',
    protection: 'Protection',
    resolution: 'Resolution',
    vigor: 'Vigor',
    might: 'Might',
    fury: 'Fury',
    regeneration: 'Regeneration',
    swiftness: 'Swiftness',
    aegis: 'Aegis',
    'target-vulnerability': 'Vulnerability',
    'necromancer-soul-barbs': 'Soul Barbs',
};
const EFFECT_STACK_CAPS = {
    'Compounding Power': 5,
    'Soul Barbs': 1,
};

const seconds = ms => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
const professionEndState = result => result?.endState?.profession || {};
const activeSpecialization = app =>
    app.adapter.eliteSpecialization(app.build);

export function formatResourceValue(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return '0';
    return String(Math.round((numeric + Number.EPSILON) * 1000) / 1000);
}

function resolveRelicIcon(label) {
  const value = String(label || "");
  for (const [name, relic] of Object.entries(RELIC_DATA)) {
    if (
      relic.icon &&
      (value === name ||
        value.startsWith(`Relic of ${name}`) ||
        value.startsWith(`Relic of the ${name}`))
    ) {
      return relic.icon;
    }
  }
  return "";
}

function resolveModifierIcon(row) {
    const id = String(row.id || '');
    const label = String(row.name || '');
    const effectIcon = MODIFIER_EFFECT_ICONS[label];
    if (effectIcon) return effectIcon;

    const sigilName = id.startsWith('Sigil:')
        ? id.slice('Sigil:'.length)
        : label.match(/^Sigil of (.+)$/)?.[1];
    if (sigilName && SIGIL_DATA[sigilName]?.icon) {
        return SIGIL_DATA[sigilName].icon;
    }

    if (label === 'Nourishment' || label === 'Food: Nourishment') {
        return NOURISHMENT_ICON;
    }
    return '';
}

function resolveProcIcon(app, proc) {
    const traits = app.attributeData?.activeTraits || [];
    const traitIcon = proc.type === 'trait_proc'
        ? traits.find(trait => trait.name === proc.skill)?.icon
        : '';
    const relicIcon = proc.type === 'relic_proc'
        ? resolveRelicIcon(proc.skill)
        : '';
    const sourceIcon = app.skillByName.get(proc.sourceSkill)?.icon;
    return proc.icon || traitIcon || relicIcon || sourceIcon || '';
}

function procFilterKey(proc) {
    return `${proc.type}:${proc.skill}`;
}

function procFilterLabel(proc) {
    const type = proc.type === 'relic_proc'
        ? 'Relic'
        : proc.type === 'skill_proc' ? 'Skill' : 'Trait';
    return `${proc.skill} (${type})`;
}

function procStackLabel(proc) {
    if (proc.skill !== 'Relic of Aristocracy') return '';
    return String(proc.detail || '').match(/^(\d+\/\d+)\s+stacks$/)?.[1] || '';
}

export function groupConsecutiveProcSteps(procSteps = []) {
    const groups = [];
    for (const proc of procSteps) {
        const key = procFilterKey(proc);
        const previous = groups.at(-1);
        if (previous?.key === key) {
            previous.steps.push(proc);
        } else {
            groups.push({ key, steps: [proc] });
        }
    }
    return groups;
}

function syncProcVisibility(app, procSteps) {
    const procKeys = new Set(procSteps.map(procFilterKey));
    const current = app.procVisibility instanceof Set ? app.procVisibility : null;
    const knownKeys = app.procVisibilityKeys instanceof Set ? app.procVisibilityKeys : null;
    app.procVisibility = new Set([...procKeys].filter(key =>
        !knownKeys || !knownKeys.has(key) || current?.has(key),
    ));
    app.procVisibilityKeys = procKeys;
    if (!current) {
        app.procVisibility = procKeys;
    }
    return app.procVisibility;
}

function rotationItem(app, name, options = {}) {
    const defaultInterruptMs = app.skillByName.get(name)?.defaultInterruptMs;
    const resolvedOptions = defaultInterruptMs != null && options.interruptMs == null
        ? { interruptMs: defaultInterruptMs, ...options }
        : options;
    return Object.keys(resolvedOptions).length ? { name, ...resolvedOptions } : name;
}

function resolvePaletteDropItem(app, name) {
    if (!name) return null;
    if (name === '__combat_start'
        && app.build.rotation.some(entry => (entry.name || entry) === '__combat_start')) {
        return null;
    }
    if (name === '__wait') {
        const raw = prompt('Wait duration (ms):', '1000');
        if (raw == null || Number(raw) < 1) return null;
        return rotationItem(app, name, { waitMs: Math.round(Number(raw)) });
    }
    return rotationItem(app, name);
}

export { moveRotationEntry };

function uniqueByName(skills) {
    return [...new Map(skills.map(skill => [skill.name, skill])).values()];
}

function currentCooldown(app, name) {
    return app.results?.endState?.cooldowns?.[name] || { remaining: 0, readyAt: 0 };
}

function currentAmmo(app, name) {
    const ammo = app.results?.endState?.ammo?.[name];
    if (!ammo) return null;
    if (ammo.remaining != null) return ammo;
    const nextChargeAt = ammo.nextChargeAt != null
        ? Number(ammo.nextChargeAt)
        : ammo.nextRechargeAt == null
            ? 0
            : Number(ammo.nextRechargeAt) * 1000;
    return {
        ...ammo,
        nextChargeAt,
        remaining: nextChargeAt
            ? Math.max(0, nextChargeAt - Number(app.results?.endState?.time || 0))
            : 0,
    };
}

function paletteSkillView(app, skill, contextAvailable = true, contextMessage = '') {
    const cd = currentCooldown(app, skill.name);
    const ammo = currentAmmo(app, skill.name);
    const maximumAmmo = ammo?.maximum ?? Number(skill.ammo || 0);
    const recharge = maximumAmmo && Number(skill.ammoRecharge || 0) > 0
        ? Number(skill.ammoRecharge)
        : Number(skill.cooldown || 0);
    const ammoDisplay = ammoDisplayView(
        ammo?.charges ?? maximumAmmo,
        maximumAmmo,
    );
    const unavailable = cd.remaining > 0 || !contextAvailable;
    const highlighted = Boolean(skill.ambush) && !unavailable;
    const castTimeSeconds = Number(skill.castTimeMs || 0) / 1000;
    const title = [
        skill.name,
        castTimeSeconds ? `Cast: ${castTimeSeconds.toFixed(2)}s` : 'Instant cast',
        recharge
            ? `${maximumAmmo ? 'Count recharge' : 'Cooldown'}: ${recharge}s`
            : '',
        !contextAvailable
            ? contextMessage || 'Unavailable in the current state'
            : ammoDisplay
                ? `${ammoDisplay.label}${
                    ammo?.remaining ? ` · next charge in ${seconds(ammo.remaining)}` : ''
                }`
                : cd.remaining
                ? `Remaining: ${seconds(cd.remaining)} · available at ${seconds(cd.readyAt)}`
                : 'Available now',
        gw2ApiText(skill.description),
    ].filter(Boolean).join('\n');
    return {
        name: skill.name,
        icon: skill.icon || ACTION_ICONS[skill.name] || PLACEHOLDER_ICON,
        title,
        color: unavailable ? '#625a73' : highlighted ? '#f0c766' : '#a88be8',
        disabled: unavailable,
        contextDisabled: !contextAvailable,
        highlighted,
        draggable: contextAvailable,
        cooldownLabel: cd.remaining ? seconds(cd.remaining) : '',
        ammo: ammoDisplay,
    };
}

export function weaponSkills(app, weaponSet = 1) {
    const [mh, oh] = weaponSet === 2
        ? app.build.alternateWeapons
        : app.build.weapons;
    const twoHanded = app.weaponData[mh]?.wielding === '2h';
    return uniqueByName(app.skills.filter(skill => {
        if (skill.type !== 'Weapon') return false;
        if (!app.adapter.isSkillAvailable(skill, {
            build: app.build,
            specialization: activeSpecialization(app),
        })) return false;
        const number = Number(String(skill.slot || '').match(/(\d)$/)?.[1] || 0);
        if (twoHanded) return skill.weapon === mh;
        return (number <= 3 && skill.weapon === mh) || (number >= 4 && skill.weapon === oh);
    })).sort((a, b) => {
        const slotOrder = String(a.slot).localeCompare(String(b.slot));
        if (slotOrder) return slotOrder;
        const chainOrder =
            Number(a.chainStep ?? Number.MAX_SAFE_INTEGER)
            - Number(b.chainStep ?? Number.MAX_SAFE_INTEGER);
        return chainOrder || 0;
    });
}

export function weaponPaletteRows(app, activeWeaponSet = 1) {
    return [1, 2]
        .map(weaponSet => ({
            id: `weapon-set-${weaponSet}`,
            label: `W${weaponSet}`,
            weaponSet,
            active: weaponSet === activeWeaponSet,
            skills: weaponSkills(app, weaponSet),
        }))
        .filter(row => row.skills.length);
}

export function weaponPaletteStackHtml(groups = []) {
    const content = groups.filter(Boolean).join('');
    if (!content) return '';
    return `<div class="weapon-palette-stack" data-role="weapon-set-stack" `
        + `style="display:flex;flex-direction:column;align-items:stretch;gap:6px">${content}</div>`;
}

export function weaponPaletteSectionHtml(weaponGroups = [], actionGroup = '') {
    const weapons = weaponPaletteStackHtml(weaponGroups);
    if (!weapons && !actionGroup) return '';
    return `<div class="weapon-palette-section" data-role="weapon-palette-section" `
        + `style="display:flex;align-items:flex-start;gap:6px">${weapons}${actionGroup}</div>`;
}

export function autoattackChainSkillAvailable(skill, chainState = {}) {
    if (!skill.chainRoot) return true;
    const expected = chainState[skill.chainRoot] ?? skill.chainRoot;
    return skill.name === expected || skill.id === Number(expected);
}

export function paletteActionSkills(app, specialization = activeSpecialization(app)) {
    return uniqueByName(app.skills.filter(skill =>
        skill.type === 'Action'
        && skill.name !== 'Continuum Shift'
        && (!skill.specialization || skill.specialization === specialization)
        && app.adapter.isSkillAvailable(skill, {
            build: app.build,
            specialization,
        })
    )).sort((left, right) =>
        (PALETTE_ACTION_ORDER.get(left.name) ?? Number.MAX_SAFE_INTEGER)
        - (PALETTE_ACTION_ORDER.get(right.name) ?? Number.MAX_SAFE_INTEGER)
        || left.name.localeCompare(right.name));
}

function addGroup(
    app,
    label,
    skills,
    color = '#a88be8',
    isAvailable = () => true,
    unavailableMessage = () => '',
) {
    if (!skills.length) return '';
    return paletteGroupHtml({
        label,
        color,
        skills: skills.map(skill =>
            paletteSkillView(app, skill, isAvailable(skill), unavailableMessage(skill))),
    });
}

function activeResourceGroup(app) {
    const professionState = professionEndState(app.results);
    const definitions = resourceDisplayViews(app.profession, {
        specialization: activeSpecialization(app),
        value:
            professionState.resource
            ?? app.build.initialResource,
        professionState,
        initialResource: app.build.initialResource,
        initialBlight: app.build.initialBlight,
    });
    const groups = definitions.map(definition => {
        const value = Math.max(0, Math.min(
            definition.maximum,
            definition.value ?? app.build[definition.buildKey],
        ));
        const displayValue = formatResourceValue(value);
        const title = `${definition.statusLabel} ${definition.plural}: ${displayValue}/${definition.maximum}`;
        const indicator = definition.displayMode === 'bar'
            ? `<div class="active-resource-bar"><span style="width:${
                definition.maximum ? value / definition.maximum * 100 : 0
            }%"></span></div>`
            : `<div class="active-resource-pips">${Array.from(
                { length: definition.maximum },
                (_, index) => `<span class="active-resource-pip${index < value ? ' active' : ''}"></span>`,
            ).join('')}</div>`;
        return `<div class="pal-group active-resource-group">
            <div class="pal-label" style="color:#c49cff">${esc(definition.shortLabel)}</div>
            <div class="active-resource" data-resource-id="${esc(definition.id)}"
                data-resource-count="${value}" title="${esc(title)}"
                aria-label="${esc(title)}">
                ${indicator}
                <strong>${displayValue}/${definition.maximum}</strong>
            </div>
        </div>`;
    }).join('');
    return definitions.length > 1
        ? `<div class="active-resource-stack">${groups}</div>`
        : groups;
}

export function timelineWeaponRows(
    rotation = [],
    { startingWeaponSet = 1 } = {},
) {
    return timelineRows(rotation, {
        startingWeaponSet,
        isWeaponSwap(entry) {
            const item = typeof entry === 'string' ? { name: entry } : entry;
            return item.name === 'Swap Weapons';
        },
        isWeaponSetRefresh(entry) {
            const item = typeof entry === 'string' ? { name: entry } : entry;
            return WEAPON_SET_REFRESH_SKILLS.has(item.name);
        },
    });
}

export function continuumEndTimelineMarkers(result, rotationLength = 0) {
    return eventTimelineMarkers(
        result,
        rotationLength,
        event =>
            event.type === 'marker'
            && event.name === 'Continuum Shift'
            && event.detail === 'split expired',
    );
}

export function targetHealthTimelineMarkers(
    result,
    targetHealth,
    thresholds = [],
    rotationLength = 0,
) {
    const percents = [...new Set(thresholds)]
        .map(threshold => Number(threshold) * 100)
        .filter(percent => percent > 0 && percent < 100);
    if (!percents.length) return [];
    const steps = (result?.steps || [])
        .filter(step => step.ri >= 0 && !step.invalid)
        .sort((left, right) => left.start - right.start || left.ri - right.ri);
    return targetHealthBreakpointSnapshots(result, targetHealth, percents)
        .map(snapshot => {
            const start = Math.round(snapshot.at * 1000);
            const next = steps.find(step => step.start >= start);
            return {
                insertionIndex: next?.ri ?? rotationLength,
                healthPercent: snapshot.healthPercent,
                start,
                damage: snapshot.damage,
            };
        });
}

export function shatterResourceSpends(result) {
    const spends = new Map();
    for (const event of result?.events || []) {
        const rotationIndex = Number(event.rotationIndex);
        if (
            event.type !== 'resource'
            || event.reason !== 'profession mechanic'
            || !Number.isInteger(rotationIndex)
        ) {
            continue;
        }
        spends.set(rotationIndex, {
            count: Math.abs(Number(event.amount || 0)),
            resource: String(event.resource || 'resources'),
            sourceSkill: String(event.sourceSkill || ''),
        });
    }
    return spends;
}

export function renderStartResource(app) {
    const element = document.getElementById('start-att-selector');
    const professionState = professionEndState(app.results);
    const definitions = resourceDisplayViews(app.profession, {
        specialization: activeSpecialization(app),
        professionState,
        value: professionState.resource ?? app.build.initialResource,
        initialResource: app.build.initialResource,
        initialBlight: app.build.initialBlight,
    });
    const hasSecondSet = Boolean(app.build.alternateWeapons?.[0]);
    const startSet = app.build.startingWeaponSet === 2 && hasSecondSet ? 2 : 1;
    const weaponControl = hasSecondSet
        ? `<span class="start-att-label">Start weapon:</span>
        <div class="weapon-set-toggle">${[1, 2].map(set =>
            `<button class="weapon-set-btn${set === startSet ? ' active' : ''}"
                data-set="${set}" title="Start on weapon set ${set}">W${set}</button>`
        ).join('')}</div>`
        : '';
    if (!definitions.length) {
        element.innerHTML = `${weaponControl}
            <span class="start-att-label end-resource">
                Active weapon: W${app.results?.endState?.activeWeaponSet || startSet}
            </span>`;
        element.querySelectorAll('.weapon-set-btn').forEach(button => {
            button.addEventListener('click', () => {
                app.build.startingWeaponSet = Number(button.dataset.set);
                app.changed();
            });
        });
        return;
    }
    const resourceControls = definitions.map(definition => {
        if (definition.canStart === false) return '';
        const key = definition.buildKey;
        const startMaximum = definition.startMaximum;
        const value = Math.max(
            0,
            Math.min(startMaximum, Number(app.build[key] || 0)),
        );
        if (definition.displayMode === 'bar') {
            return `<label class="start-att-label start-resource-number">
                Start ${esc(definition.plural)}:
                <input type="number" min="0" max="${startMaximum}"
                    step="${definition.step}" value="${value}"
                    data-resource-key="${esc(key)}">
            </label>`;
        }
        return `<span class="start-att-label">Start ${esc(definition.plural)}:</span>
            <div class="resource-pips">${Array.from(
                { length: definition.maximum },
                (_, index) =>
                    `<button class="resource-pip${index < value ? ' active' : ''}"
                        data-count="${index + 1}" data-resource-key="${esc(key)}"
                        title="${index + 1} ${esc(definition.plural)}"></button>`,
            ).join('')}</div>`;
    }).join('');
    const currentResources = definitions.map(definition =>
        `${esc(definition.shortLabel)} ${
            formatResourceValue(
                definition.value ?? Number(app.build[definition.buildKey] || 0),
            )
        }/${definition.maximum}`
    ).join(' · ');

    element.innerHTML = `${weaponControl}${resourceControls}
        <span class="start-att-label end-resource">Active ${currentResources}
            · W${app.results?.endState?.activeWeaponSet || startSet}</span>`;
    element.querySelectorAll('.resource-pip').forEach(button => {
        button.addEventListener('click', () => {
            const count = Number(button.dataset.count);
            const key = button.dataset.resourceKey || 'initialResource';
            app.build[key] = count === app.build[key] ? count - 1 : count;
            app.changed();
        });
    });
    element.querySelectorAll('input[data-resource-key]').forEach(input => {
        input.addEventListener('change', () => {
            const key = input.dataset.resourceKey || 'initialResource';
            app.build[key] = Math.max(
                Number(input.min || 0),
                Math.min(Number(input.max), Number(input.value) || 0),
            );
            app.changed();
        });
    });
    element.querySelectorAll('.weapon-set-btn').forEach(button => {
        button.addEventListener('click', () => {
            app.build.startingWeaponSet = Number(button.dataset.set);
            app.changed();
        });
    });
}

export function renderPalette(app) {
    const element = document.getElementById('rotation-palette');
    const spec = activeSpecialization(app);
    const paletteContext = {
        specialization: spec,
        catalog: app.profession.catalog,
        professionState: professionEndState(app.results),
        build: app.build,
    };
    const professionGroups = paletteView(app.profession, paletteContext);
    const renderedProfessionGroups = professionGroups.map(group => ({
        ...group,
        skills: group.skillIds
            .map(id => app.skillById.get(id))
            .filter(skill => skill && skill.type !== 'Action'),
    }));
    const mechanics = renderedProfessionGroups
        .find(group => group.id === 'profession')?.skills || [];
    if (spec === 'Chronomancer') {
        const shift = app.skillByName.get('Continuum Shift');
        const splitIndex = mechanics.findIndex(skill => skill.name === 'Continuum Split');
        if (shift) mechanics.splice(splitIndex + 1, 0, shift);
    }
    const selected = Object.values(app.build.selectedSkills)
        .map(name => app.skillByName.get(name))
        .filter(Boolean);
    // Non-weapon flips (Mantra of Pain → Power Spike) ride alongside their
    // selected parent so the palette can offer the flip while it is armed.
    const utilityFlipByParent = new Map(
        app.skills
            .filter(skill => skill.flipParent && skill.type !== 'Weapon')
            .map(skill => [skill.flipParent, skill]));
    const selectedWithFlips = uniqueByName(selected).flatMap(skill => {
        const flip = utilityFlipByParent.get(skill.name);
        return flip ? [skill, flip] : [skill];
    });
    const actions = paletteActionSkills(app, spec);
    const activeWeaponSet = app.results?.endState?.activeWeaponSet || 1;
    const professionState = professionEndState(app.results);
    const continuumActive = Boolean(professionState.continuumActive);
    const availableFlips = professionState.availableFlips || {};
    const availableAmbush = professionState.availableAmbush || null;
    const autoattackChains = professionState.autoattackChains || {};
    const professionAllowsPaletteSkill = skill =>
        app.profession.ui.isPaletteSkillAvailable?.(
            paletteContext,
            skill,
        ) !== false;
    const professionPaletteUnavailableMessage = skill =>
        app.profession.ui.paletteSkillUnavailableMessage?.(
            paletteContext,
            skill,
        ) || '';
    const flipAvailable = skill => Boolean(
        availableFlips[skill.id] ?? availableFlips[skill.name],
    );
    const chainExpected = skill => {
        const root = skill.chainRoot;
        return autoattackChains[root] || root;
    };
    const weaponSkillAvailable = (skill, weaponSet) => {
        if (weaponSet !== activeWeaponSet) return false;
        if (!professionAllowsPaletteSkill(skill)) return false;
        if (skill.ambush) return availableAmbush?.name === skill.name;
        if (availableAmbush && skill.slot === 'Weapon_1') return false;
        if ((skill.flipParent || skill.flipParentId != null) && !flipAvailable(skill)) return false;
        return autoattackChainSkillAvailable(skill, autoattackChains);
    };
    const weaponSkillUnavailableMessage = (skill, weaponSet) => {
        if (weaponSet !== activeWeaponSet) {
            return `Swap to weapon set ${weaponSet} to use this skill`;
        }
        if (!professionAllowsPaletteSkill(skill)) {
            return professionPaletteUnavailableMessage(skill);
        }
        if (skill.ambush) {
            return availableAmbush
                ? `Current ambush is ${availableAmbush.name}`
                : 'Gain Mirage Cloak to use this ambush';
        }
        if (availableAmbush && skill.slot === 'Weapon_1') {
            return `${availableAmbush.name} currently replaces weapon skill 1`;
        }
        if ((skill.flipParent || skill.flipParentId != null) && !flipAvailable(skill)) {
            return `Unavailable until ${skill.flipParent} has been used`;
        }
        if (skill.chainRoot) {
            const expected = chainExpected(skill);
            if (skill.name !== expected && skill.id !== Number(expected)) {
                const expectedSkill = app.skillById.get(Number(expected));
                return `Cast ${expectedSkill?.name || expected} first`;
            }
        }
        return '';
    };
    // A charged mantra shows its flip (Power Spike); the parent (Mantra of Pain)
    // stays locked until every charge is spent and the flip reverts.
    const armedFlipFor = skill => {
        const flip = utilityFlipByParent.get(skill.name);
        return flip && availableFlips[flip.name] ? flip : null;
    };
    const utilitySkillAvailable = skill => {
        if (!professionAllowsPaletteSkill(skill)) return false;
        if (skill.flipParent) return flipAvailable(skill);
        return !armedFlipFor(skill);
    };
    const utilitySkillUnavailableMessage = skill => {
        if (!professionAllowsPaletteSkill(skill)) {
            return professionPaletteUnavailableMessage(skill);
        }
        if (skill.flipParent && !flipAvailable(skill)) {
            return `Unavailable until ${skill.flipParent} has been used`;
        }
        const flip = armedFlipFor(skill);
        if (flip) return `Unavailable while ${flip.name} has charges`;
        return '';
    };

    const professionSkillAvailable = skill => {
        if (!professionAllowsPaletteSkill(skill)) return false;
        if (skill.name === 'Continuum Shift') return continuumActive;
        if ((skill.flipParent || skill.flipParentId != null) && !flipAvailable(skill)) {
            return false;
        }
        return true;
    };
    const professionSkillUnavailableMessage = skill => {
        if (!professionAllowsPaletteSkill(skill)) {
            return professionPaletteUnavailableMessage(skill);
        }
        if (skill.name === 'Continuum Shift') return 'Unavailable until Continuum Split is active';
        if ((skill.flipParent || skill.flipParentId != null) && !flipAvailable(skill)) {
            return `Unavailable until ${skill.flipParent} has been used`;
        }
        return '';
    };
    element.innerHTML =
        renderedProfessionGroups.map(group => addGroup(
            app,
            group.label,
            group.skills,
            group.color || '#c49cff',
            professionSkillAvailable,
            professionSkillUnavailableMessage,
        )).join('') +
        activeResourceGroup(app) +
        weaponPaletteSectionHtml(
            weaponPaletteRows(app, activeWeaponSet).map(row => addGroup(
                app,
                row.label,
                row.skills,
                row.active ? '#a98fd8' : '#625a73',
                skill => weaponSkillAvailable(skill, row.weaponSet),
                skill => weaponSkillUnavailableMessage(skill, row.weaponSet),
            )),
            addGroup(app, 'Act', actions, '#70b6d0'),
        ) +
        addGroup(app, 'Skill', selectedWithFlips, '#cbb8ea', utilitySkillAvailable, utilitySkillUnavailableMessage) +
        // Timeline-only controls stay on their own row.
        '<div class="pal-break"></div>' +
        `<div class="pal-group"><div class="pal-label" style="color:#d66d2f">Cmb</div>
            <div class="pal-row">${virtualPaletteSkillHtml({
                name: '__combat_start',
                title: 'Combat Start',
                icon: COMBAT_START_ICON,
                disabled: app.build.rotation.some(item => (item.name || item) === '__combat_start'),
            })}</div>
        </div>
        <div class="pal-group"><div class="pal-label" style="color:#8d7a57">W8</div>
            <div class="pal-row">${virtualPaletteSkillHtml({
                name: '__wait',
                title: 'Wait',
                icon: WAIT_ICON,
            })}</div>
        </div>`;

    bindPaletteInteractions(element, {
        onActivate(name, event) {
            const icon = event.currentTarget;
            if (name === '__combat_start' && icon.classList.contains('pal-disabled')) return;
            if (name === '__wait') {
                const raw = prompt('Wait duration (ms):', '1000');
                if (raw == null || Number(raw) < 1) return;
                app.addRotation(name, { waitMs: Math.round(Number(raw)) });
                return;
            }
            const skill = app.skillByName.get(name);
            const instant = name === '__combat_start' || Number(skill?.castTimeMs || 0) === 0;
            if (event.shiftKey && instant && app.build.rotation.length) {
                app.addRotation(name, { offset: CONCURRENT_OFFSET_MS });
            } else if (event.ctrlKey && !instant) {
                const full = Math.round(Number(skill?.castTimeMs || 0));
                const raw = prompt(`Interrupt ${name} after how many ms?`, String(Math.max(1, full - 1)));
                if (raw == null || Number(raw) < 1) return;
                app.addRotation(name, { interruptMs: Math.round(Number(raw)) });
            } else {
                app.addRotation(name);
            }
        },
        onDragStart(name) {
            app.dragState = { source: 'palette', name };
        },
        onDragEnd() {
            app.dragState = null;
            clearTimelineDropIndicators(document.getElementById('rotation-timeline'));
        },
    });
}

function editRotationOption(app, index, key, label) {
    const entry = app.build.rotation[index];
    const item = typeof entry === 'string' ? { name: entry } : entry;
    const raw = prompt(label, String(item?.[key] ?? ''));
    if (raw == null || Number(raw) < 1) return false;
    app.build.rotation[index] = updateRotationEntry(entry, {
        [key]: Math.round(Number(raw)),
    });
    return true;
}

function timelineInteractionOptions(app) {
    return {
        rotation: app.build.rotation,
        getDragState: () => app.dragState,
        setDragState: value => {
            app.dragState = value;
        },
        resolvePaletteEntry: name => resolvePaletteDropItem(app, name),
        onChanged: () => app.changed(false),
        onRemove: index => app.build.rotation.splice(index, 1),
        onTruncate: index => app.build.rotation.splice(index),
        onEditOffset: index => editRotationOption(
            app,
            index,
            'offset',
            'Offset (ms) from the start of the preceding cast:',
        ),
        onEditInterrupt: index => editRotationOption(
            app,
            index,
            'interruptMs',
            'Interrupt time (ms):',
        ),
        onEditWait: index => editRotationOption(
            app,
            index,
            'waitMs',
            'Wait duration (ms):',
        ),
    };
}

export function renderTimeline(app) {
    const element = document.getElementById('rotation-timeline');
    const procElement = document.getElementById('rotation-procs');
    const procPanelWasOpen = procElement?.querySelector('.rotation-procs-wrap')?.open ?? false;
    element.ondragover = null;
    element.ondragleave = null;
    element.ondrop = null;
    if (!app.build.rotation.length) {
        element.classList.add('is-empty');
        element.innerHTML = `<div class="rot-empty">
            <strong>Build your rotation</strong>
            <span>Click or drag skills from the palette above</span>
        </div>`;
        if (procElement) procElement.innerHTML = '';
        bindTimelineInteractions(element, timelineInteractionOptions(app));
        return;
    }
    element.classList.remove('is-empty');
    const resultSteps = app.results?.steps || [];
    const steps = new Map(resultSteps
        .filter(step => step.ri >= 0)
        .map(step => [step.ri, step]));
    const castOrdinals = timelineSkillCastOrdinals(resultSteps);
    const resourceSpends = shatterResourceSpends(app.results);
    const rows = timelineWeaponRows(app.build.rotation, {
        startingWeaponSet: app.build.startingWeaponSet,
    });
    const formatTime = timeMs => formatResultTimelineTime(timeMs, app.results);

    const continuumEnds = continuumEndTimelineMarkers(
        app.results,
        app.build.rotation.length,
    );
    const continuumEndsByIndex = new Map();
    for (const marker of continuumEnds) {
        const markers = continuumEndsByIndex.get(marker.insertionIndex) || [];
        markers.push(marker);
        continuumEndsByIndex.set(marker.insertionIndex, markers);
    }
    const targetThresholds = app.profession.ui.targetHealthThresholds?.({
        specialization: activeSpecialization(app),
        build: app.build,
        professionState: professionEndState(app.results),
    }) || [];
    const healthMarkers = targetHealthTimelineMarkers(
        app.results,
        app.build.targetHealth,
        targetThresholds,
        app.build.rotation.length,
    );
    const healthMarkersByIndex = new Map();
    for (const marker of healthMarkers) {
        const markers = healthMarkersByIndex.get(marker.insertionIndex) || [];
        markers.push(marker);
        healthMarkersByIndex.set(marker.insertionIndex, markers);
    }
    const renderContinuumEnd = marker => {
        const time = formatTime(marker.start);
        const detail = [
            'Continuum Shift',
            `Continuum Split ended automatically at ${time}`,
            'Cooldown state restored',
        ].join('\n');
        return `<div class="rot-skill rot-injected" title="${esc(detail)}"
            style="--att-border:#d6b46b">
            <img src="${esc(ACTION_ICONS['Continuum Shift'])}" alt="" />
            <span class="rot-injected-badge">AUTO</span>
            <span class="rot-time">${time}</span>
        </div>`;
    };
    const renderHealthMarker = marker => {
        const time = formatTime(marker.start);
        const label = `${marker.healthPercent}%`;
        const detail = [
            `Target reached ${label} health`,
            `At ${time}`,
            `${Math.round(marker.damage).toLocaleString()} cumulative damage`,
        ].join('\n');
        return `<div class="rot-skill rot-injected rot-health-marker"
            title="${esc(detail)}" style="--att-border:#d96b6b">
            <img src="${esc(COMBAT_START_ICON)}" alt="" />
            <span class="rot-injected-badge">${esc(label)}</span>
            <span class="rot-time">${time}</span>
        </div>`;
    };

    let timelineHtml = rows.map((row, rowNumber) => {
        const weapons = row.weaponSet === 1 ? app.build.weapons : app.build.alternateWeapons;
        const weaponLabel = weapons.filter(Boolean).join('/') || 'Unequipped';
        const rowItems = [];
        row.skills.forEach(({ entry, index }) => {
            for (const marker of healthMarkersByIndex.get(index) || []) {
                rowItems.push(renderHealthMarker(marker));
            }
            for (const marker of continuumEndsByIndex.get(index) || []) {
                rowItems.push(renderContinuumEnd(marker));
            }
            const item = typeof entry === 'string' ? { name: entry } : entry;
            const skill = app.skillByName.get(item.name);
            const step = steps.get(index);
            const invalid = Boolean(step?.invalid);
            const display = item.name === '__wait' ? 'Wait'
                : item.name === '__combat_start' ? 'Combat Start' : item.name;
            const icon = item.name === '__wait'
                ? WAIT_ICON
                : item.name === '__combat_start'
                    ? COMBAT_START_ICON
                    : skill?.icon || ACTION_ICONS[skill?.name] || PLACEHOLDER_ICON;
            const time = step && !invalid ? formatTime(step.start) : '';
            const resourceSpend = resourceSpends.get(index);
            const resourceSingular = resourceSpend?.resource.endsWith('s')
                ? resourceSpend.resource.slice(0, -1)
                : resourceSpend?.resource;
            const resourceSpendTiming = resourceSpend?.resource === 'blades'
                ? 'cast end'
                : 'cast start';
            const resourceLabel = resourceSpend
                ? `${resourceSpend.count} ${
                    resourceSpend.count === 1
                        ? resourceSingular
                        : resourceSpend.resource
                } consumed at ${resourceSpendTiming}`
                : '';
            const resourceShortLabel = resourceSpend
                ? `${resourceSpend.count}${
                    resourceSpend.resource === 'blades'
                        ? 'B'
                        : resourceSpend.resource === 'clones' ? 'C' : 'R'
                }`
                : '';
            const skillTooltip = (
                step
                && !invalid
                && item.name !== '__wait'
                && item.name !== '__combat_start'
            )
                ? formatTimelineSkillTooltip(
                    display,
                    step,
                    castOrdinals.get(index),
                    formatTime,
                )
                : display;
            const titleSuffix = invalid
                ? `\n${step.invalidReason || 'Not valid here — will not be simulated'}`
                : step && (
                    item.name === '__wait'
                    || item.name === '__combat_start'
                )
                    ? `\n${formatTimelineCastDetails(step, formatTime)}`
                    : '';
            const resourceTitle = resourceLabel ? `\n${resourceLabel}` : '';
            const concurrentLabel = item.offset != null
                ? formatConcurrentTimelineBadge(item.offset, time)
                : '';
            const interruptLabel = item.interruptMs != null
                ? formatInterruptTimelineBadge(item.interruptMs, time)
                : '';
            rowItems.push(`<div class="rot-skill${item.offset != null ? ' rot-concurrent' : ''}${invalid ? ' rot-invalid' : ''}" draggable="true"
                    data-idx="${index}" title="${esc(skillTooltip)}${titleSuffix}${resourceTitle}" style="--att-border:#9d7bd0">
                    <img src="${esc(icon)}" alt="" />
                    <span class="rot-x" title="Remove (Shift: remove this and everything after)">×</span>
                    ${invalid ? '<span class="rot-invalid-badge" title="Invalid — not simulated">✕</span>' : ''}
                    ${resourceSpend ? `<span class="rot-resource-spend-badge"
                        title="${esc(resourceLabel)}" aria-label="${esc(resourceLabel)}">${esc(resourceShortLabel)}</span>` : ''}
                    ${time && item.offset == null && item.interruptMs == null ? `<span class="rot-time">${time}</span>` : ''}
                    ${item.offset != null ? `<span class="rot-offset-badge rot-timed-action-badge" data-idx="${index}"
                        title="Delay ${item.offset}ms; cast at ${esc(time)}">${esc(concurrentLabel)}</span>` : ''}
                    ${item.interruptMs != null ? `<span class="rot-gapfill-badge rot-interrupt-badge rot-timed-action-badge"
                        data-idx="${index}" title="Interrupt after ${item.interruptMs}ms; cast at ${esc(time)}">${esc(interruptLabel)}</span>` : ''}
                    ${item.waitMs != null ? `<span class="rot-gapfill-badge rot-wait-badge" data-idx="${index}">⌛${item.waitMs}ms</span>` : ''}
                </div>`);
        });
        if (rowNumber === rows.length - 1) {
            for (const marker of healthMarkersByIndex.get(
                app.build.rotation.length,
            ) || []) {
                rowItems.push(renderHealthMarker(marker));
            }
            for (const marker of continuumEndsByIndex.get(app.build.rotation.length) || []) {
                rowItems.push(renderContinuumEnd(marker));
            }
        }
        const skills = rowItems
            .map((item, index) => `${index ? '<span class="rot-arrow">→</span>' : ''}${item}`)
            .join('');
        const insertAt = row.skills.length ? row.skills.at(-1).index + 1 : 0;
        return `<div class="rot-row" style="--row-color:#9d7bd0">
            <div class="rot-row-label" title="Weapon set ${row.weaponSet}: ${esc(weaponLabel)}">W${row.weaponSet}</div>
            <div class="rot-row-skills" data-insert-idx="${insertAt}">${skills}</div>
        </div>`;
    }).join('');

    const procColors = {
        relic_proc: '#ddaa33',
        trait_proc: '#77cc77',
        skill_proc: '#bb88ff',
    };
    const procSteps = [...(app.results?.procSteps || [])]
        .sort((a, b) => a.start - b.start);
    if (procSteps.length) {
        const procVisibility = syncProcVisibility(app, procSteps);
        const procOptions = [...new Map(
            procSteps.map(proc => [procFilterKey(proc), proc]),
        ).values()].sort((a, b) => procFilterLabel(a).localeCompare(procFilterLabel(b)));
        const visibleProcCount = procOptions.filter(proc => procVisibility.has(procFilterKey(proc))).length;
        const procs = groupConsecutiveProcSteps(procSteps).map(group => {
            const proc = group.steps[0];
            const { key } = group;
            const icon = resolveProcIcon(app, proc) || PLACEHOLDER_ICON;
            const type = proc.type === 'relic_proc'
                ? 'Relic'
                : proc.type === 'skill_proc' ? 'Skill' : 'Trait';
            const time = formatTime(proc.start);
            const count = group.steps.length;
            const stackLabel = procStackLabel(group.steps.at(-1));
            const detail = count === 1
                ? [
                    proc.skill,
                    `${type} proc at ${time}`,
                    proc.sourceSkill ? `Triggered by ${proc.sourceSkill}` : '',
                    proc.detail || '',
                ].filter(Boolean).join('\n')
                : [
                    proc.skill,
                    `${type} proc x${count}`,
                    ...group.steps.map((step, index) => [
                        `${index + 1}. ${formatTime(step.start)}`,
                        step.sourceSkill ? `Triggered by ${step.sourceSkill}` : '',
                        step.detail || '',
                    ].filter(Boolean).join(' - ')),
                ].join('\n');
            return `<div class="proc-icon" data-proc-key="${esc(key)}"${procVisibility.has(key) ? '' : ' hidden'} title="${esc(detail)}"
                style="--proc-color:${procColors[proc.type] || '#9d7bd0'}">
                <img src="${esc(icon)}" alt="" />
                ${count > 1 ? `<span class="proc-count">&times;${count}</span>` : ''}
                ${stackLabel ? `<span class="proc-stack">${esc(stackLabel)}</span>` : ''}
                <span class="proc-time">${time}</span>
            </div>`;
        }).join('');
        if (procElement) procElement.innerHTML = `<details class="rotation-procs-wrap"${procPanelWasOpen ? ' open' : ''}>
            <summary>Procs (${procSteps.length} activation${procSteps.length === 1 ? '' : 's'})</summary>
            <div class="rotation-procs-content">
                <details class="proc-filter"${app.procFilterOpen ? ' open' : ''}>
                    <summary title="Choose which proc types are shown">Visible <span class="proc-filter-count">${visibleProcCount}/${procOptions.length}</span></summary>
                    <div class="proc-filter-menu">
                        ${procOptions.map(proc => {
                            const key = procFilterKey(proc);
                            return `<label class="proc-filter-option">
                                <input type="checkbox" data-proc-key="${esc(key)}"${procVisibility.has(key) ? ' checked' : ''}>
                                <span>${esc(procFilterLabel(proc))}</span>
                            </label>`;
                        }).join('')}
                    </div>
                </details>
                <div class="proc-icons-row">${procs}</div>
            </div>
        </details>`;
    } else if (procElement) procElement.innerHTML = '';
    element.innerHTML = timelineHtml;

    const procFilter = procElement?.querySelector('.proc-filter');
    if (procFilter) {
        procFilter.addEventListener('toggle', () => {
            app.procFilterOpen = procFilter.open;
        });
        procFilter.querySelectorAll('input[data-proc-key]').forEach(input => {
            input.addEventListener('change', () => {
                const key = input.dataset.procKey;
                if (input.checked) app.procVisibility.add(key);
                else app.procVisibility.delete(key);
                app.procFilterOpen = true;
                procElement.querySelectorAll('.proc-icon[data-proc-key]').forEach(procIcon => {
                    procIcon.hidden = !app.procVisibility.has(procIcon.dataset.procKey);
                });
                const count = procFilter.querySelector('.proc-filter-count');
                if (count) {
                    const visible = procFilter.querySelectorAll('input[data-proc-key]:checked').length;
                    const total = procFilter.querySelectorAll('input[data-proc-key]').length;
                    count.textContent = `${visible}/${total}`;
                }
            });
        });
    }

    const procIconsRow = procElement?.querySelector('.proc-icons-row');
    if (procIconsRow) {
        const applyProcHighlight = () => {
            const icons = [...procIconsRow.querySelectorAll('.proc-icon[data-proc-key]')];
            const key = app.procHighlightKey;
            const active = !!key && icons.some(icon => icon.dataset.procKey === key);
            if (!active) app.procHighlightKey = null;
            icons.forEach(icon => {
                const match = active && icon.dataset.procKey === key;
                icon.classList.toggle('proc-highlight', match);
                icon.classList.toggle('proc-faded', active && !match);
            });
        };
        procIconsRow.querySelectorAll('.proc-icon[data-proc-key]').forEach(icon => {
            icon.addEventListener('click', () => {
                const key = icon.dataset.procKey;
                app.procHighlightKey = app.procHighlightKey === key ? null : key;
                applyProcHighlight();
            });
        });
        applyProcHighlight();
    }

    bindTimelineInteractions(element, timelineInteractionOptions(app));
}

export function resultSummaryMetrics(result) {
    // Metric duration follows the resolver's DPS clock. This is intentionally
    // independent from the explicit marker used as timeline display zero.
    const referenceSeconds = Math.max(
        0,
        Number(result?.dpsStartTime ?? result?.firstHitTime ?? 0),
    );
    if (referenceSeconds <= 0) {
        return transformResultSummaryMetrics(result);
    }
    return transformResultSummaryMetrics({
        ...result,
        duration: Math.max(0, Number(result?.duration || 0) - referenceSeconds),
        deathTime: result?.deathTime == null
            ? null
            : Math.max(0, Number(result.deathTime) - referenceSeconds),
    });
}

export function resultCombatReferenceMs(result) {
    const marker = result?.events?.find(event => event.type === 'combat_start');
    if (!marker) return 0;
    return Number(marker.at || 0) * 1000;
}

export function formatResultTimelineTime(timeMs, result, digits = 2) {
    const precision = 10 ** digits;
    const seconds = (Number(timeMs || 0) - resultCombatReferenceMs(result)) / 1000;
    const normalized = Math.abs(seconds) < (0.5 / precision) ? 0 : seconds;
    return `${normalized.toFixed(digits)}s`;
}

const baseBreakdownName = name => String(name || '').split('—')[0].trim();

const eventLogOrder = {
    combat_start: 5,
    cast: 10,
    'mesmer.phantasm-summoned': 20,
    'mesmer.phantasm-resummoned': 21,
    'mesmer.phantasm-attack': 22,
    resource: 30,
    marker: 40,
    proc: 50,
    trigger: 55,
    damage: 60,
    condition: 70,
    cast_end: 90,
};

export function simulationEventLogRows(result, build = null) {
    const rows = [];
    const displayReferenceSeconds = resultCombatReferenceMs(result) / 1000;
    const maximumResource = Number(
        professionEndState(result).resourceDefinition?.maximum || 0,
    );
    const push = (at, type, description, className = '', phantasmClone = false) => {
        const displayAt = Number(at || 0) - displayReferenceSeconds;
        rows.push({
            at: Math.abs(displayAt) < 1e-12 ? 0 : displayAt,
            type,
            description,
            className,
            phantasmClone,
            order: eventLogOrder[type] ?? 80,
        });
    };

    for (const event of result?.events || []) {
        if (event.type === 'damage' || event.type === 'condition') continue;
        switch (event.type) {
            case 'combat_start':
                push(
                    event.at,
                    event.type,
                    'COMBAT START',
                    'trigger',
                );
                break;
            case 'action': {
                const durationMs = Math.max(
                    0,
                    Math.round((Number(event.endsAt || event.at) - Number(event.at || 0)) * 1000),
                );
                push(event.at, 'cast', `CAST ${event.name} (${durationMs}ms)`);
                push(event.endsAt, 'cast_end', `END ${event.name}`);
                break;
            }
            case 'mesmer.phantasm-summoned':
                push(
                    event.at,
                    event.type,
                    `PHANTASM SUMMONED ${event.name} x${event.count}`,
                    'phantasm',
                    true,
                );
                break;
            case 'mesmer.phantasm-resummoned':
                push(
                    event.at,
                    event.type,
                    `PHANTASM RESUMMONED ${event.name} x${event.count} [Chronophantasma]`,
                    'phantasm',
                    true,
                );
                break;
            case 'mesmer.phantasm-attack':
                push(
                    event.at,
                    event.type,
                    `PHANTASM DAMAGE COMPLETE ${event.name} x${event.count}${event.repeat ? ' [repeat]' : ''}`,
                    'phantasm',
                    true,
                );
                break;
            case 'resource': {
                const amount = Number(event.amount || 0);
                const resource = String(event.resource || 'resource');
                const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;
                const reason = event.reason ? ` [${event.reason}]` : '';
                const created = (event.created || [])
                    .map(clone =>
                        `Clone #${clone.id}${clone.weapon ? ` [${clone.weapon}]` : ''}`)
                    .join(', ');
                const isCloneResource = resource === 'clones';
                if (amount > 0) {
                    push(
                        event.at,
                        event.type,
                        `${singular.toUpperCase()} SPAWNED x${amount} -> ${event.value}/${maximumResource}${reason}${created ? ` (${created})` : ''}`,
                        'resource',
                        isCloneResource,
                    );
                } else {
                    push(
                        event.at,
                        event.type,
                        `${resource.toUpperCase()} SPENT x${Math.abs(amount)} -> ${event.value}/${maximumResource}${reason}`,
                        'resource',
                        isCloneResource,
                    );
                }
                break;
            }
            case 'marker':
                push(
                    event.at,
                    event.type,
                    `EVENT ${event.name}${event.detail ? ` - ${event.detail}` : ''}`,
                    'trigger',
                );
                break;
            case 'proc':
                push(
                    event.at,
                    event.type,
                    `${String(event.procType || 'effect').toUpperCase()} ${event.name}${event.sourceSkill ? ` [${event.sourceSkill}]` : ''}${event.detail ? ` - ${event.detail}` : ''}`,
                    event.procType || 'trigger',
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
                    `BUFF ${effectName(event.kind)} x${event.stacks || 1}${event.duration ? ` (${event.duration}s)` : ''}`,
                    'trigger',
                );
                break;
            case 'mesmer.instrument':
                push(
                    event.at,
                    'trigger',
                    `INSTRUMENT ${event.instrument}${event.expiresAt ? ` until ${Number(event.expiresAt).toFixed(3)}s` : ''}`,
                    'trigger',
                );
                break;
            default:
                break;
        }
    }

    for (const event of result?.resolvedEvents || []) {
        if (event.type === 'damage') {
            const isCloneHit = event.source === 'Clone';
            const source = isCloneHit ? 'CLONE HIT' : 'HIT';
            push(
                event.at,
                'damage',
                `${source} ${event.name} x${event.hits || 1} -> ${Math.round(Number(event.damage || 0)).toLocaleString()} damage`,
                isCloneHit ? 'resource' : '',
                isCloneHit,
            );
        } else if (event.type === 'condition') {
            push(
                event.at,
                'condition',
                `CONDITION ${event.condition} x${event.stacks || 1} (${Number(event.duration || 0).toFixed(2)}s) [${event.skillName}]`,
                'condition',
            );
        }
    }

    return rows
        .sort((a, b) => a.at - b.at || a.order - b.order || a.description.localeCompare(b.description))
        .map(({ order, ...row }) => row);
}

export function simulationEventLogCsv(rows) {
    return eventLogCsv(rows);
}

export function renderEventLog(app) {
    const element = document.getElementById('rotation-event-log');
    const result = app.results;
    if (!element || !app.build.rotation.length || !result) {
        if (element) element.innerHTML = '';
        return;
    }
    const eventLog = simulationEventLogRows(result, app.build);
    const hasPhantasmClone = eventLog.some(event => event.phantasmClone);
    mountEventLog(element, eventLog.map(event => ({
        ...event,
        rowClassName: event.phantasmClone ? 'log-phantasm' : '',
    })), {
        title: 'Event Log',
        filename: app.adapter?.filenames?.eventLog || 'event-log.csv',
        filters: hasPhantasmClone ? [{
            id: 'phantasm',
            label: 'Phantasm & Clone only',
            predicate: event => event.phantasmClone,
        }] : [],
    });
}

export function skillBreakdownRows(result) {
    return transformSkillBreakdownRows(result);
}

function effectName(kind) {
    if (EFFECT_NAMES[kind]) return EFFECT_NAMES[kind];
    return String(kind || '')
        .split('-')
        .filter(Boolean)
        .map(part => `${part[0]?.toUpperCase() || ''}${part.slice(1)}`)
        .join(' ');
}

export function buildChartSeries(result, sampleStepMs = 250) {
    return buildSharedChartSeries(result, sampleStepMs, {
        effectName,
        stackCaps: EFFECT_STACK_CAPS,
    });
}

export function resultSkillIcon(app, row) {
    if (row.icon) return row.icon;
    const breakdownName = baseBreakdownName(row.name);
    const cloneAttackName = breakdownName.startsWith('Clone: ')
        ? breakdownName.slice('Clone: '.length)
        : '';
    const procNames = new Set([
        row.name,
        row.sourceSkill,
        breakdownName,
        RESULT_PROC_NAMES[row.name],
        RESULT_PROC_NAMES[row.sourceSkill],
        RESULT_PROC_NAMES[breakdownName],
    ].filter(Boolean));
    const matchingProc = (app.results?.procSteps || []).find(proc =>
        procNames.has(proc.skill));
    const procIcon = matchingProc && resolveProcIcon(app, matchingProc);
    if (procIcon) return procIcon;

    const modifierIcon = resolveModifierIcon(row);
    if (modifierIcon) return modifierIcon;

    const traits = app.attributeData?.activeTraits || [];
    const trait = traits.find(candidate =>
        candidate.name === row.name
        || candidate.name === breakdownName
        || row.name.includes(candidate.name));
    if (trait?.icon) return trait.icon;

    const relicIcon = resolveRelicIcon(row.name);
    if (relicIcon) return relicIcon;

    for (const name of [
        row.name,
        row.sourceSkill,
        row.parentSkill,
        breakdownName,
        cloneAttackName,
    ]) {
        const icon = app.skillByName.get(name)?.icon;
        if (icon) return icon;
    }

    if (row.name.endsWith(' Clone')) {
        const weapon = row.name.slice(0, -' Clone'.length);
        const autoattack = app.skills.find(skill =>
            skill.type === 'Weapon'
            && skill.weapon === weapon
            && String(skill.slot).endsWith('1'));
        if (autoattack?.icon) return autoattack.icon;
    }
    return PLACEHOLDER_ICON;
}

export { chartValueAt };

export function renderResults(app) {
    const element = document.getElementById('rotation-results');
    const result = app.results;
    if (!app.build.rotation.length || !result) {
        element.innerHTML = '';
        return;
    }
    const metrics = resultSummaryMetrics(result);
    const skillRows = skillBreakdownRows(result);
    const conditions = result.conditionBreakdown || [];
    const series = buildChartSeries(result);
    const contributions = (result.contributions || []).map(contribution => ({
        ...contribution,
        icon: resultSkillIcon(app, contribution),
    }));
    const breakpoints = targetHealthBreakpointSnapshots(
        result,
        app.build.targetHealth,
    );
    app._skillBreakdownState = { skillRows };
    mountRotationResults(element, {
        metrics,
        breakpoints,
        skillRows,
        skillColumns: SKILL_COLS,
        conditions,
        conditionTotal: conditions.length ? {
            label: 'Total Conditions',
            damage: result.conditionDamage,
            dps: result.conditionDamage / Math.max(
                0.001,
                Number(result.dpsWindow ?? result.duration ?? 0),
            ),
        } : null,
        contributions,
        warnings: result.warnings || [],
        chartSeries: series,
    }, {
        resolveSkillIcon: row => resultSkillIcon(app, row),
        placeholderIcon: PLACEHOLDER_ICON,
        skillBreakdownClassName: `${app.adapter.id}-skill-breakdown`,
        chartOptions: {
            title: 'DPS & Effects Over Time',
            dpsLabel: 'Average DPS',
            dpsColor: '#54c96b',
            colors: EFFECT_COLORS,
            defaultVisibleEffectLimit: 8,
            emptyEffectsText: 'No timed effects in this rotation',
        },
        sortState: {
            column: app._skillSortCol,
            direction: app._skillSortDir,
        },
        onSortStateChange(nextState) {
            app._skillSortCol = nextState.column;
            app._skillSortDir = nextState.direction;
        },
    });
}

export function renderRotationBuilder(app) {
    renderStartResource(app);
    renderPalette(app);
    renderTimeline(app);
    renderEventLog(app);
    renderResults(app);
}
