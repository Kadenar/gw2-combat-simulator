import { MECHANIC_SKILLS } from '../sim/mechanics/mesmer-profession-data.js';
import { PSEUDO_SKILLS } from '../sim/mechanics/mesmer-skill-normalization.js';
import { eliteSpecialization } from './app-runtime.js';

const CONCURRENT_OFFSET_MS = 100;
const PLACEHOLDER_ICON = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23232632"/%3E%3Cpath d="M17 46L32 13l15 33z" fill="%23a38ad5"/%3E%3C/svg%3E';
const COMBAT_START_ICON = 'https://wiki.guildwars2.com/images/e/e9/Call_Target.png';
const WAIT_ICON = 'https://wiki.guildwars2.com/images/8/83/%22sipcoffee%22_Emote_Tome.png';
const ACTION_ICONS = {
    'Dodge / Mirage Cloak': 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    'Swap Weapons': 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    'Continuum Shift': 'https://wiki.guildwars2.com/images/d/d7/Continuum_Shift.png',
};
const RELIC_ICONS = {
    'Relic of Akeem': 'https://render.guildwars2.com/file/594C437E9606A167F4F372BCEB0C2B7C7828037B/3122330.png',
    'Relic of Aristocracy': 'https://render.guildwars2.com/file/BCC01F0B6616FE26ED4BE159532A6A6FBD0EA2D8/3122332.png',
    'Relic of the Eagle': 'https://render.guildwars2.com/file/DFF4EB43AD0803F60D105658052321A0BE1AF02C/3592832.png',
    'Relic of Fireworks': 'https://render.guildwars2.com/file/2999CCF7C94267B2EE3DDA7459050864622927C9/3122349.png',
    'Relic of the Fractal': 'https://render.guildwars2.com/file/B2D409644147BF18935A95A52505ABCB9EECE142/3122351.png',
    'Relic of Peitha': 'https://render.guildwars2.com/file/949A6A4179F514FCDEF3AC3D9C292B38D5E0047D/3122365.png',
    'Relic of the Thief': 'https://render.guildwars2.com/file/3523AC08EB04347CF371E9A91F4B985D12FB4ED3/3122371.png',
    'Relic of Thorns': 'https://wiki.guildwars2.com/images/8/8a/Relic_of_Thorns.png',
};
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
};
const EFFECT_NAMES = {
    compounding: 'Compounding Power',
    'phantom-pain': 'Phantom Pain',
    'illusionary-membrane': 'Illusionary Membrane',
    'deadly-blades': 'Deadly Blades',
    'altered-chord': 'Altered Chord',
    fencer: "Fencer's Finesse",
};
const EFFECT_STACK_CAPS = {
    'Compounding Power': 5,
};

const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const seconds = ms => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;

function uniqueByName(skills) {
    return [...new Map(skills.map(skill => [skill.name, skill])).values()];
}

function currentCooldown(app, name) {
    return app.results?.endState?.cooldowns?.[name] || { remaining: 0, readyAt: 0 };
}

function currentAmmo(app, name) {
    return app.results?.endState?.ammo?.[name] || null;
}

function paletteIcon(app, skill, contextAvailable = true, contextMessage = '') {
    const cd = currentCooldown(app, skill.name);
    const ammo = currentAmmo(app, skill.name);
    const unavailable = cd.remaining > 0 || !contextAvailable;
    const activation = Number(skill.activation || 0);
    const title = [
        skill.name,
        activation ? `Cast: ${activation.toFixed(2)}s` : 'Instant cast',
        skill.cooldown ? `Cooldown: ${skill.cooldown}s` : '',
        !contextAvailable
            ? contextMessage || 'Unavailable in the current state'
            : ammo
                ? `${ammo.charges}/${ammo.maximum} ammo${
                    ammo.remaining ? ` · next charge in ${seconds(ammo.remaining)}` : ''
                }`
                : cd.remaining
                ? `Remaining: ${seconds(cd.remaining)} · available at ${seconds(cd.readyAt)}`
                : 'Available now',
        skill.description || '',
    ].filter(Boolean).join('\n');
    return `<div class="pal-skill${unavailable ? ' pal-disabled' : ''}${!contextAvailable ? ' pal-context-disabled' : ''}"
        data-skill="${esc(skill.name)}" title="${esc(title)}" draggable="${contextAvailable}"
        style="--att-border:${unavailable ? '#625a73' : '#a88be8'}">
        <img src="${esc(skill.icon || ACTION_ICONS[skill.name] || PLACEHOLDER_ICON)}" alt="" />
        ${cd.remaining ? `<span class="pal-cd">${seconds(cd.remaining)}</span>` : ''}
        ${ammo ? `<span class="pal-charges">${ammo.charges}/${ammo.maximum}</span>` : ''}
    </div>`;
}

function virtualIcon(name, label, icon, disabled = false) {
    return `<div class="pal-skill${disabled ? ' pal-disabled' : ''}" data-skill="${name}"
        title="${esc(label)}" draggable="${disabled ? 'false' : 'true'}" style="--att-border:#8d7a57">
        <img src="${esc(icon)}" alt="" />
    </div>`;
}

function weaponSkills(app) {
    const activeSet = app.results?.endState?.activeWeaponSet || 1;
    const [mh, oh] = activeSet === 2
        ? app.build.alternateWeapons
        : app.build.weapons;
    const twoHanded = app.weaponData[mh]?.wielding === '2h';
    return uniqueByName(app.skills.filter(skill => {
        if (skill.type !== 'Weapon') return false;
        const number = Number(String(skill.slot || '').match(/(\d)$/)?.[1] || 0);
        if (twoHanded) return skill.weapon === mh;
        return (number <= 3 && skill.weapon === mh) || (number >= 4 && skill.weapon === oh);
    })).sort((a, b) => String(a.slot).localeCompare(String(b.slot)));
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
    return `<div class="pal-group">
        <div class="pal-label" style="color:${color}">${esc(label)}</div>
        <div class="pal-row">${skills.map(skill =>
            paletteIcon(app, skill, isAvailable(skill), unavailableMessage(skill))
        ).join('')}</div>
    </div>`;
}

function activeResourceGroup(app) {
    const definition = app.results?.endState?.resourceDefinition
        || app.resourceDefinition(eliteSpecialization(app.build));
    const value = Math.max(0, Math.min(
        definition.maximum,
        app.results?.endState?.resource ?? app.build.initialResource,
    ));
    const cloneResource = definition.singular === 'clone';
    const label = cloneResource ? 'Cln' : definition.singular.slice(0, 3);
    const title = `${cloneResource ? 'Active' : 'Current'} ${definition.plural}: ${value}/${definition.maximum}`;
    return `<div class="pal-group active-resource-group">
        <div class="pal-label" style="color:#c49cff">${esc(label)}</div>
        <div class="active-resource" data-resource-count="${value}" title="${esc(title)}"
            aria-label="${esc(title)}">
            <div class="active-resource-pips">${Array.from(
                { length: definition.maximum },
                (_, index) => `<span class="active-resource-pip${index < value ? ' active' : ''}"></span>`,
            ).join('')}</div>
            <strong>${value}/${definition.maximum}</strong>
        </div>
    </div>`;
}

export function timelineWeaponRows(rotation = []) {
    const rows = [{ weaponSet: 1, skills: [] }];
    let weaponSet = 1;
    rotation.forEach((entry, index) => {
        const item = typeof entry === 'string' ? { name: entry } : entry;
        rows.at(-1).skills.push({ entry, index });
        if (item.name === 'Swap Weapons') {
            weaponSet = weaponSet === 1 ? 2 : 1;
            if (index < rotation.length - 1) {
                rows.push({ weaponSet, skills: [] });
            }
        }
    });
    return rows;
}

export function renderStartResource(app) {
    const element = document.getElementById('start-att-selector');
    const definition = app.results?.endState?.resourceDefinition
        || app.resourceDefinition(eliteSpecialization(app.build));
    // Clones only exist in combat, so those specs never open with resource and
    // the start selector is hidden for them. Blades/notes keep their opener.
    const cloneResource = definition.singular === 'clone';
    const value = cloneResource
        ? 0
        : Math.max(0, Math.min(definition.maximum, app.build.initialResource));

    const hasSecondSet = Boolean(app.build.alternateWeapons?.[0]);
    const startSet = app.build.startingWeaponSet === 2 && hasSecondSet ? 2 : 1;
    const weaponControl = hasSecondSet
        ? `<span class="start-att-label">Start weapon:</span>
        <div class="weapon-set-toggle">${[1, 2].map(set =>
            `<button class="weapon-set-btn${set === startSet ? ' active' : ''}"
                data-set="${set}" title="Start on weapon set ${set}">W${set}</button>`
        ).join('')}</div>`
        : '';

    const resourceControl = cloneResource
        ? ''
        : `<span class="start-att-label">Start ${esc(definition.plural)}:</span>
        <div class="resource-pips">${Array.from({ length: definition.maximum }, (_, index) =>
            `<button class="resource-pip${index < value ? ' active' : ''}" data-count="${index + 1}"
                title="${index + 1} ${esc(definition.plural)}"></button>`
        ).join('')}</div>`;

    element.innerHTML = `${weaponControl}${resourceControl}
        <span class="start-att-label end-resource">Active ${esc(definition.plural)}:
            ${app.results?.endState?.resource ?? value}/${definition.maximum}
            · W${app.results?.endState?.activeWeaponSet || startSet}</span>`;
    element.querySelectorAll('.resource-pip').forEach(button => {
        button.addEventListener('click', () => {
            const count = Number(button.dataset.count);
            app.build.initialResource = count === app.build.initialResource ? count - 1 : count;
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
    const spec = eliteSpecialization(app.build);
    const mechanicNames = MECHANIC_SKILLS[spec] || MECHANIC_SKILLS.Core;
    const mechanics = mechanicNames.map(name => app.skillByName.get(name)).filter(Boolean);
    if (spec === 'Chronomancer') {
        const shift = app.skillByName.get('Continuum Shift');
        const splitIndex = mechanics.findIndex(skill => skill.name === 'Continuum Split');
        if (shift) mechanics.splice(splitIndex + 1, 0, shift);
    }
    const selected = Object.values(app.build.selectedSkills)
        .map(name => app.skillByName.get(name))
        .filter(Boolean);
    const actions = PSEUDO_SKILLS.filter(skill =>
        skill.type === 'Action'
        && skill.name !== 'Continuum Shift'
        && (!skill.specialization || skill.specialization === spec));
    const activeWeaponSet = app.results?.endState?.activeWeaponSet || 1;
    const continuumActive = Boolean(app.results?.endState?.continuumActive);
    const availableFlips = app.results?.endState?.availableFlips || {};
    const autoattackChains = app.results?.endState?.autoattackChains || {};
    const weaponSkillAvailable = skill => {
        if (skill.flipParent && !availableFlips[skill.name]) return false;
        if (!skill.chainRoot) return true;
        const expected = autoattackChains[skill.chainRoot] || skill.chainRoot;
        return skill.name === expected;
    };
    const weaponSkillUnavailableMessage = skill => {
        if (skill.flipParent && !availableFlips[skill.name]) {
            return `Unavailable until ${skill.flipParent} has been used`;
        }
        if (skill.chainRoot) {
            const expected = autoattackChains[skill.chainRoot] || skill.chainRoot;
            if (skill.name !== expected) return `Cast ${expected} first`;
        }
        return '';
    };

    element.innerHTML =
        addGroup(
            app,
            'F',
            mechanics,
            '#c49cff',
            skill => skill.name !== 'Continuum Shift' || continuumActive,
            skill => skill.name === 'Continuum Shift'
                ? 'Unavailable until Continuum Split is active'
                : '',
        ) +
        activeResourceGroup(app) +
        addGroup(
            app,
            `W${activeWeaponSet}`,
            weaponSkills(app),
            '#a98fd8',
            weaponSkillAvailable,
            weaponSkillUnavailableMessage,
        ) +
        addGroup(app, 'Skill', uniqueByName(selected), '#cbb8ea') +
        // Actions live on their own row so weapon skills can grow without
        // shoving Dodge/Combat Start/Wait into an awkward wrap.
        '<div class="pal-break"></div>' +
        addGroup(app, 'Act', actions, '#70b6d0') +
        `<div class="pal-group"><div class="pal-label" style="color:#d66d2f">Cmb</div>
            <div class="pal-row">${virtualIcon('__combat_start', 'Combat Start', COMBAT_START_ICON, app.build.rotation.some(item => (item.name || item) === '__combat_start'))}</div>
        </div>
        <div class="pal-group"><div class="pal-label" style="color:#8d7a57">W8</div>
            <div class="pal-row">${virtualIcon('__wait', 'Wait', WAIT_ICON)}</div>
        </div>`;

    element.querySelectorAll('.pal-skill').forEach(icon => {
        const name = icon.dataset.skill;
        icon.addEventListener('click', event => {
            if (icon.classList.contains('pal-context-disabled')) return;
            if (name === '__combat_start' && icon.classList.contains('pal-disabled')) return;
            if (name === '__wait') {
                const raw = prompt('Wait duration (ms):', '1000');
                if (raw == null || Number(raw) < 1) return;
                app.addRotation(name, { waitMs: Math.round(Number(raw)) });
                return;
            }
            const skill = app.skillByName.get(name);
            const instant = name === '__combat_start' || Number(skill?.activation || 0) === 0;
            if (event.shiftKey && instant && app.build.rotation.length) {
                app.addRotation(name, { offset: CONCURRENT_OFFSET_MS });
            } else if (event.ctrlKey && !instant) {
                const full = Math.round(Number(skill?.activation || 0) * 1000);
                const raw = prompt(`Interrupt ${name} after how many ms?`, String(Math.max(1, full - 1)));
                if (raw == null || Number(raw) < 1) return;
                app.addRotation(name, { interruptMs: Math.round(Number(raw)) });
            } else {
                app.addRotation(name);
            }
        });
        icon.addEventListener('dragstart', event => {
            event.dataTransfer.setData('text/plain', name);
            event.dataTransfer.effectAllowed = 'copy';
        });
    });
}

export function renderTimeline(app) {
    const element = document.getElementById('rotation-timeline');
    element.ondragover = null;
    element.ondrop = null;
    if (!app.build.rotation.length) {
        element.innerHTML = '<div class="rot-empty">Click skills above to build rotation</div>';
        element.ondragover = event => event.preventDefault();
        element.ondrop = event => {
            event.preventDefault();
            const name = event.dataTransfer.getData('text/plain');
            if (!name) return;
            app.addRotation(name, name === '__wait' ? { waitMs: 1000 } : {});
        };
        return;
    }
    const steps = new Map((app.results?.steps || []).filter(step => step.ri >= 0).map(step => [step.ri, step]));
    const rows = timelineWeaponRows(app.build.rotation);

    let timelineHtml = rows.map(row => {
        const weapons = row.weaponSet === 1 ? app.build.weapons : app.build.alternateWeapons;
        const weaponLabel = weapons.filter(Boolean).join('/') || 'Unequipped';
        const skills = row.skills.map(({ entry, index }, rowIndex) => {
            const item = typeof entry === 'string' ? { name: entry } : entry;
            const skill = app.skillByName.get(item.name);
            const step = steps.get(index);
            const display = item.name === '__wait' ? 'Wait'
                : item.name === '__combat_start' ? 'Combat Start' : item.name;
            const icon = item.name === '__wait'
                ? WAIT_ICON
                : item.name === '__combat_start'
                    ? COMBAT_START_ICON
                    : skill?.icon || ACTION_ICONS[skill?.name] || PLACEHOLDER_ICON;
            const time = step ? `${(step.start / 1000).toFixed(2)}s` : '';
            return `${rowIndex ? '<span class="rot-arrow">→</span>' : ''}
                <div class="rot-skill${item.offset != null ? ' rot-concurrent' : ''}" draggable="true"
                    data-idx="${index}" title="${esc(display)}${step ? `\nCast: ${(step.start / 1000).toFixed(2)}s → ${(step.end / 1000).toFixed(2)}s` : ''}">
                    <img src="${esc(icon)}" alt="" />
                    <span class="rot-x" title="Remove (Shift: remove this and everything after)">×</span>
                    ${time ? `<span class="rot-time">${time}</span>` : ''}
                    ${item.offset != null ? `<span class="rot-offset-badge" data-idx="${index}">⊙${item.offset}ms</span>` : ''}
                    ${item.interruptMs != null ? `<span class="rot-gapfill-badge rot-interrupt-badge" data-idx="${index}">✂${item.interruptMs}ms</span>` : ''}
                    ${item.waitMs != null ? `<span class="rot-gapfill-badge rot-wait-badge" data-idx="${index}">⌛${item.waitMs}ms</span>` : ''}
                </div>`;
        }).join('');
        return `<div class="rot-row" style="--row-color:#9d7bd0">
            <div class="rot-row-label" title="Weapon set ${row.weaponSet}: ${esc(weaponLabel)}">W${row.weaponSet}</div>
            <div class="rot-row-skills">${skills}</div>
        </div>`;
    }).join('');

    const procColors = {
        relic_proc: '#ddaa33',
        trait_proc: '#77cc77',
    };
    const procSteps = [...(app.results?.procSteps || [])]
        .sort((a, b) => a.start - b.start);
    if (procSteps.length) {
        const activeTraits = app.attributeData?.activeTraits || [];
        const procs = procSteps.map(proc => {
            const traitIcon = proc.type === 'trait_proc'
                ? activeTraits.find(trait => trait.name === proc.skill)?.icon
                : '';
            const relicIcon = proc.type === 'relic_proc'
                ? RELIC_ICONS[proc.skill]
                : '';
            const sourceIcon = app.skillByName.get(proc.sourceSkill)?.icon;
            const icon = traitIcon || relicIcon || sourceIcon || PLACEHOLDER_ICON;
            const type = proc.type === 'relic_proc' ? 'Relic' : 'Trait';
            const time = `${(proc.start / 1000).toFixed(2)}s`;
            const detail = [
                proc.skill,
                `${type} proc at ${time}`,
                proc.sourceSkill ? `Triggered by ${proc.sourceSkill}` : '',
                proc.detail || '',
            ].filter(Boolean).join('\n');
            return `<div class="proc-icon" title="${esc(detail)}"
                style="--proc-color:${procColors[proc.type] || '#9d7bd0'}">
                <img src="${esc(icon)}" alt="" />
                <span class="proc-time">${time}</span>
            </div>`;
        }).join('');
        timelineHtml += `<div class="rot-row rot-procs-row">
            <div class="rot-row-label">Procs</div>
            <div class="rot-row-skills proc-icons-row">${procs}</div>
        </div>`;
    }
    element.innerHTML = timelineHtml;

    element.querySelectorAll('.rot-x').forEach(remove => {
        remove.addEventListener('click', event => {
            event.stopPropagation();
            const index = Number(remove.parentElement.dataset.idx);
            if (event.shiftKey) app.build.rotation.splice(index);
            else app.build.rotation.splice(index, 1);
            app.changed(false);
        });
    });
    element.querySelectorAll('.rot-skill').forEach(item => {
        item.addEventListener('dragstart', event => {
            event.dataTransfer.setData('application/x-rotation-index', item.dataset.idx);
            event.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragover', event => event.preventDefault());
        item.addEventListener('drop', event => {
            event.preventDefault();
            const to = Number(item.dataset.idx);
            const rawFrom = event.dataTransfer.getData('application/x-rotation-index');
            if (rawFrom !== '') {
                const from = Number(rawFrom);
                const [moved] = app.build.rotation.splice(from, 1);
                app.build.rotation.splice(to, 0, moved);
            } else {
                const name = event.dataTransfer.getData('text/plain');
                if (!name) return;
                app.build.rotation.splice(to, 0, name === '__wait' ? { name, waitMs: 1000 } : name);
            }
            app.changed(false);
        });
    });
    element.querySelectorAll('.rot-offset-badge').forEach(badge => {
        badge.addEventListener('click', event => {
            event.stopPropagation();
            const index = Number(badge.dataset.idx);
            const item = app.build.rotation[index];
            const raw = prompt('Offset (ms) from the start of the preceding cast:', String(item.offset));
            if (raw == null || Number(raw) < 1) return;
            item.offset = Math.round(Number(raw));
            app.changed(false);
        });
    });
    element.querySelectorAll('.rot-interrupt-badge').forEach(badge => {
        badge.addEventListener('click', event => {
            event.stopPropagation();
            const index = Number(badge.dataset.idx);
            const item = app.build.rotation[index];
            const raw = prompt('Interrupt time (ms):', String(item.interruptMs));
            if (raw == null || Number(raw) < 1) return;
            item.interruptMs = Math.round(Number(raw));
            app.changed(false);
        });
    });
    element.querySelectorAll('.rot-wait-badge').forEach(badge => {
        badge.addEventListener('click', event => {
            event.stopPropagation();
            const index = Number(badge.dataset.idx);
            const item = app.build.rotation[index];
            const raw = prompt('Wait duration (ms):', String(item.waitMs));
            if (raw == null || Number(raw) < 1) return;
            item.waitMs = Math.round(Number(raw));
            app.changed(false);
        });
    });
}

export function resultSummaryMetrics(result) {
    const metrics = [
        { label: 'Duration', value: `${result.duration.toFixed(2)}s`, className: '' },
    ];
    if (result.deathTime != null) {
        metrics.push({
            label: 'Kill Time',
            value: `${Number(result.deathTime).toFixed(2)}s`,
            className: 'kill-time',
        });
    }
    metrics.push(
        { label: 'Total Damage', value: Math.round(result.totalDamage).toLocaleString(), className: '' },
        { label: 'DPS', value: Math.round(result.dps).toLocaleString(), className: 'dps' },
        { label: 'Strike', value: Math.round(result.strikeDamage).toLocaleString(), className: '' },
        { label: 'Condition', value: Math.round(result.conditionDamage).toLocaleString(), className: 'condi' },
    );
    return metrics;
}

const baseBreakdownName = name => String(name || '').split('—')[0].trim();

const eventLogOrder = {
    cast: 10,
    phantasm_summoned: 20,
    phantasm_resummoned: 21,
    phantasm_attack: 22,
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
    const maximumResource = Number(result?.endState?.resourceDefinition?.maximum || 0);
    const push = (at, type, description, className = '', phantasmClone = false) => {
        rows.push({
            at: Number(at || 0),
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
            case 'action': {
                const durationMs = Math.max(
                    0,
                    Math.round((Number(event.endsAt || event.at) - Number(event.at || 0)) * 1000),
                );
                push(event.at, 'cast', `CAST ${event.name} (${durationMs}ms)`);
                push(event.endsAt, 'cast_end', `END ${event.name}`);
                break;
            }
            case 'phantasm_summoned':
                push(
                    event.at,
                    event.type,
                    `PHANTASM SUMMONED ${event.name} x${event.count}`,
                    'phantasm',
                    true,
                );
                break;
            case 'phantasm_resummoned':
                push(
                    event.at,
                    event.type,
                    `PHANTASM RESUMMONED ${event.name} x${event.count} [Chronophantasma]`,
                    'phantasm',
                    true,
                );
                break;
            case 'phantasm_attack':
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
            case 'instrument':
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
    const cell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    return [
        ['Time (s)', 'Type', 'Event'].map(cell).join(','),
        ...rows.map(row => [
            Number(row.at || 0).toFixed(3),
            row.type,
            row.description,
        ].map(cell).join(',')),
    ].join('\r\n');
}

export function renderEventLog(app) {
    const element = document.getElementById('rotation-event-log');
    const result = app.results;
    if (!element || !app.build.rotation.length || !result) {
        if (element) element.innerHTML = '';
        return;
    }
    const wasOpen = element.querySelector('details')?.open ?? false;
    const wasPhantasmOnly = element.querySelector('.log-filter-phantasm')?.checked ?? false;
    const eventLog = simulationEventLogRows(result, app.build);
    element.innerHTML = `<details class="res-log-wrap"${wasOpen ? ' open' : ''}>
        <summary>Event Log (${eventLog.length} events)</summary>
        <div class="log-controls">
            <button type="button" class="btn-csv-export">Download CSV Log</button>
            <label class="log-filter-label">
                <input type="checkbox" class="log-filter-phantasm"${wasPhantasmOnly ? ' checked' : ''} />
                Phantasm &amp; Clone only
            </label>
        </div>
        <div class="res-log${wasPhantasmOnly ? ' log-phantasm-only' : ''}"></div>
    </details>`;
    const details = element.querySelector('details');
    const logElement = element.querySelector('.res-log');
    const renderLogLines = () => {
        if (!logElement || logElement.dataset.rendered === 'true') return;
        logElement.innerHTML = eventLog.map(event =>
            `<div class="log-line${event.phantasmClone ? ' log-phantasm' : ''}">
                <span class="log-time">${event.at.toFixed(3)}s</span>
                <span class="log-desc${event.className ? ` ${esc(event.className)}` : ''}">${esc(event.description)}</span>
            </div>`
        ).join('');
        logElement.dataset.rendered = 'true';
    };
    if (details?.open) renderLogLines();
    details?.addEventListener('toggle', () => {
        if (details.open) renderLogLines();
    });
    element.querySelector('.log-filter-phantasm')?.addEventListener('change', e => {
        element.querySelector('.res-log')?.classList.toggle('log-phantasm-only', e.target.checked);
    });
    element.querySelector('.btn-csv-export')?.addEventListener('click', () => {
        const blob = new Blob([simulationEventLogCsv(eventLog)], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'mesmer-event-log.csv';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    });
}

export function skillBreakdownRows(result) {
    const actionDurations = new Map();
    const actionCounts = new Map();
    for (const event of result.events || []) {
        if (event.type !== 'action') continue;
        actionDurations.set(
            event.name,
            (actionDurations.get(event.name) || 0)
                + Math.max(0, Number(event.endsAt || event.at) - Number(event.at || 0)),
        );
        actionCounts.set(event.name, (actionCounts.get(event.name) || 0) + 1);
    }

    const resolvedByName = new Map();
    for (const event of result.resolvedEvents || []) {
        if (!resolvedByName.has(event.name)) resolvedByName.set(event.name, event);
    }

    const grouped = new Map();
    for (const entry of result.breakdown || []) {
        const sourceEvent = resolvedByName.get(entry.name);
        const sourceSkill = sourceEvent?.skillName || baseBreakdownName(entry.name);
        const current = grouped.get(sourceSkill) || {
            name: sourceSkill,
            sourceSkill,
            strike: 0,
            condition: 0,
            hits: 0,
            fallbackCasts: 0,
        };
        current.strike += Number(entry.strikeDamage || 0);
        current.condition += Number(entry.conditionDamage || 0);
        current.hits += Number(entry.hits || 0);
        current.fallbackCasts = Math.max(
            current.fallbackCasts,
            Number(entry.casts || 0),
        );
        grouped.set(sourceSkill, current);
    }

    return [...grouped.values()]
        .map(entry => {
            const casts = Number(
                actionCounts.get(entry.sourceSkill)
                ?? entry.fallbackCasts
                ?? 0,
            );
            const total = entry.strike + entry.condition;
            const castTime = Number(actionDurations.get(entry.sourceSkill) || 0);
            return {
                name: entry.name,
                sourceSkill: entry.sourceSkill,
                strike: entry.strike,
                condition: entry.condition,
                total,
                dps: total / Math.max(
                    0.001,
                    Number(result.dpsWindow ?? result.duration ?? 0),
                ),
                average: casts > 0 ? total / casts : null,
                dct: castTime > 0 ? total / castTime : null,
                casts,
                hits: entry.hits,
            };
        })
        .filter(row => row.total > 0)
        .sort((a, b) => b.total - a.total);
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
    const durationMs = Math.max(
        1,
        Math.round(Number(result.deathTime ?? result.duration ?? 0) * 1000),
    );
    const interval = Math.max(50, Math.min(1000, Number(sampleStepMs) || 250));
    const times = [];
    for (let time = 0; time < durationMs; time += interval) times.push(time);
    times.push(durationMs);

    const resolved = result.resolvedEvents || [];
    const strikeEvents = resolved.filter(event =>
        event.type === 'damage' && Number(event.damage || 0) > 0);
    const conditionEvents = resolved.filter(event =>
        event.type === 'condition' && Number(event.damage || 0) > 0);
    const dpsStartMs = Number(
        result.dpsStartTime ?? result.firstHitTime ?? 0,
    ) * 1000;
    const dps = times.map(time => {
        const elapsedSeconds = (time - dpsStartMs) / 1000;
        if (elapsedSeconds <= 0) return { t: time, v: 0 };
        let cumulativeDamage = 0;
        for (const event of strikeEvents) {
            if (Number(event.at || 0) * 1000 <= time) {
                cumulativeDamage += Number(event.damage || 0);
            }
        }
        for (const event of conditionEvents) {
            if (Array.isArray(event.damageTicks)) {
                for (const tick of event.damageTicks) {
                    if (Number(tick.at || 0) * 1000 <= time) {
                        cumulativeDamage += Number(tick.damage || 0);
                    }
                }
                continue;
            }
            if (Number(event.at || 0) * 1000 <= time) {
                cumulativeDamage += Number(event.damage || 0);
            }
        }
        return { t: time, v: cumulativeDamage / elapsedSeconds };
    });

    const applications = [];
    for (const event of resolved) {
        if (event.type !== 'condition') continue;
        const start = Number(event.at || 0) * 1000;
        const end = Number(
            event.expiresAt
            ?? (Number(event.at || 0) + Number(event.effectiveDuration ?? event.duration ?? 0)),
        ) * 1000;
        if (end > start) {
            applications.push({
                name: effectName(event.condition),
                start,
                end,
                stacks: Number(event.stacks || 1),
            });
        }
    }
    for (const event of result.events || []) {
        if (event.type !== 'buff' || !Number(event.duration || 0)) continue;
        const start = Number(event.at || 0) * 1000;
        applications.push({
            name: effectName(event.kind),
            start,
            end: start + Number(event.duration) * 1000,
            stacks: Number(event.stacks || 1),
        });
    }

    const effects = {};
    for (const name of [...new Set(applications.map(entry => entry.name))]) {
        const matching = applications.filter(entry => entry.name === name);
        effects[name] = times.map(time => ({
            t: time,
            v: Math.min(
                EFFECT_STACK_CAPS[name] ?? Infinity,
                matching.reduce(
                    (sum, entry) =>
                        sum + (entry.start <= time && entry.end > time ? entry.stacks : 0),
                    0,
                ),
            ),
        }));
    }
    return { durationMs, dps, effects };
}

function resultIcon(app, row) {
    const traits = app.attributeData?.activeTraits || [];
    const trait = traits.find(candidate =>
        candidate.name === row.name
        || candidate.name === baseBreakdownName(row.name)
        || row.name.includes(candidate.name));
    if (trait?.icon) return trait.icon;

    const relicName = Object.keys(RELIC_ICONS).find(name => row.name.startsWith(name));
    if (relicName) return RELIC_ICONS[relicName];

    for (const name of [row.name, row.sourceSkill, baseBreakdownName(row.name)]) {
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

const chartNumber = value => {
    const number = Number(value || 0);
    if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}m`;
    if (number >= 1000) return `${(number / 1000).toFixed(number >= 10_000 ? 0 : 1)}k`;
    return number.toFixed(number < 10 && number % 1 ? 1 : 0);
};

function niceAxisMaximum(value) {
    if (!(value > 0)) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const normalized = value / magnitude;
    const rounded = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return rounded * magnitude;
}

function drawLineChart(canvas, lines, durationMs, height = 260) {
    if (!canvas) return null;
    const cssWidth = Math.max(
        360,
        Math.floor(canvas.parentElement?.clientWidth || canvas.closest('.chart-wrap')?.clientWidth || 760),
    );
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = `${height}px`;
    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, cssWidth, height);

    const pad = { top: 16, right: 16, bottom: 28, left: 54 };
    const plotWidth = cssWidth - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const maxValue = niceAxisMaximum(Math.max(
        0,
        ...lines.flatMap(line => line.points.map(point => Number(point.v || 0))),
    ));
    context.font = '10px sans-serif';
    context.lineWidth = 1;
    context.textBaseline = 'middle';

    for (let index = 0; index <= 5; index += 1) {
        const ratio = index / 5;
        const y = pad.top + plotHeight * (1 - ratio);
        context.strokeStyle = 'rgba(255,255,255,.08)';
        context.beginPath();
        context.moveTo(pad.left, y);
        context.lineTo(cssWidth - pad.right, y);
        context.stroke();
        context.fillStyle = '#8d8d9f';
        context.textAlign = 'right';
        context.fillText(chartNumber(maxValue * ratio), pad.left - 7, y);

        const x = pad.left + plotWidth * ratio;
        context.textAlign = 'center';
        context.textBaseline = 'top';
        context.fillText(
            `${((durationMs * ratio) / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`,
            x,
            height - pad.bottom + 8,
        );
        context.textBaseline = 'middle';
    }

    for (const line of lines) {
        if (!line.points.length) continue;
        context.strokeStyle = line.color;
        context.lineWidth = 2;
        context.beginPath();
        line.points.forEach((point, index) => {
            const x = pad.left + (Number(point.t || 0) / durationMs) * plotWidth;
            const y = pad.top + (1 - Number(point.v || 0) / maxValue) * plotHeight;
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
        });
        context.stroke();
    }

    if (!lines.length) {
        context.fillStyle = '#8d8d9f';
        context.textAlign = 'center';
        context.fillText('No timed effects in this rotation', pad.left + plotWidth / 2, pad.top + plotHeight / 2);
    }

    return {
        cssWidth,
        height,
        pad,
        plotWidth,
        plotHeight,
    };
}

function chartHtml(series) {
    const effects = Object.keys(series.effects);
    return `<div class="chart-wrap">
        <div class="chart-title">DPS &amp; Effects Over Time</div>
        <div class="chart-toggles">
            <label><input type="checkbox" data-series="dps" checked />
                <span class="swatch" style="background:#54c96b"></span>DPS</label>
            ${effects.map((name, index) => `<label>
                <input type="checkbox" data-series="${esc(name)}" ${index < 8 ? 'checked' : ''} />
                <span class="swatch" style="background:${EFFECT_COLORS[name] || `hsl(${(index * 61 + 210) % 360} 62% 62%)`}"></span>
                ${esc(name)}
            </label>`).join('')}
        </div>
        <div class="chart-panels">
            <div class="chart-panel">
                <div class="chart-panel-title">DPS Over Time</div>
                <div class="chart-canvas-wrap">
                    <canvas id="rotation-chart"></canvas>
                    <div class="chart-tooltip" id="rotation-chart-tooltip"></div>
                </div>
            </div>
            <div class="chart-panel">
                <div class="chart-panel-title">Effects Over Time</div>
                <div class="chart-canvas-wrap">
                    <canvas id="rotation-effects-chart"></canvas>
                    <div class="chart-tooltip" id="rotation-effects-tooltip"></div>
                </div>
            </div>
        </div>
    </div>`;
}

export function chartValueAt(points, time) {
    if (!points?.length) return 0;
    let value = Number(points[0].v || 0);
    for (const point of points) {
        if (Number(point.t || 0) > time) break;
        value = Number(point.v || 0);
    }
    return value;
}

function bindCharts(element, series) {
    const chartState = {
        dpsLayout: null,
        effectsLayout: null,
        effectLines: [],
    };

    const redraw = () => {
        const selected = new Set(
            [...element.querySelectorAll('.chart-toggles input:checked')]
                .map(input => input.dataset.series),
        );
        chartState.dpsLayout = drawLineChart(
            element.querySelector('#rotation-chart'),
            selected.has('dps')
                ? [{ name: 'DPS', color: '#54c96b', points: series.dps }]
                : [],
            series.durationMs,
            280,
        );
        const effectLines = Object.entries(series.effects)
            .filter(([name]) => selected.has(name))
            .map(([name, points], index) => ({
                name,
                points,
                color: EFFECT_COLORS[name] || `hsl(${(index * 61 + 210) % 360} 62% 62%)`,
            }));
        chartState.effectLines = effectLines;
        chartState.effectsLayout = drawLineChart(
            element.querySelector('#rotation-effects-chart'),
            effectLines,
            series.durationMs,
            260,
        );
    };

    const bindHover = (canvasId, tooltipId, kind) => {
        const canvas = element.querySelector(`#${canvasId}`);
        const tooltip = element.querySelector(`#${tooltipId}`);
        if (!canvas || !tooltip) return;

        canvas.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
        canvas.addEventListener('mousemove', event => {
            const layout = kind === 'dps'
                ? chartState.dpsLayout
                : chartState.effectsLayout;
            if (!layout) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = layout.cssWidth / Math.max(1, rect.width);
            const scaleY = layout.height / Math.max(1, rect.height);
            const pointerX = event.clientX - rect.left;
            const pointerY = event.clientY - rect.top;
            const chartX = pointerX * scaleX;
            const chartY = pointerY * scaleY;
            const minX = layout.pad.left;
            const maxX = layout.cssWidth - layout.pad.right;
            const minY = layout.pad.top;
            const maxY = layout.pad.top + layout.plotHeight;

            if (chartX < minX || chartX > maxX || chartY < minY || chartY > maxY) {
                tooltip.style.display = 'none';
                return;
            }

            const time = Math.max(
                0,
                Math.min(
                    series.durationMs,
                    ((chartX - minX) / layout.plotWidth) * series.durationMs,
                ),
            );
            const timeLabel = `${(time / 1000).toFixed(2)}s`;
            let body;
            if (kind === 'dps') {
                const dps = Math.round(chartValueAt(series.dps, time));
                body = `<div>DPS: ${dps.toLocaleString()}</div>`;
            } else {
                const entries = chartState.effectLines
                    .map(line => ({
                        name: line.name,
                        value: Math.round(chartValueAt(line.points, time)),
                    }))
                    .filter(entry => entry.value > 0);
                body = entries.length
                    ? entries.map(entry => `<div>${esc(entry.name)}: ${entry.value}</div>`).join('')
                    : '<div>No visible stack effects</div>';
            }

            tooltip.innerHTML = `<div><b>${timeLabel}</b></div>${body}`;
            tooltip.style.left = `${pointerX + 12}px`;
            tooltip.style.top = `${pointerY + 12}px`;
            tooltip.style.display = 'block';
        });
    };

    element.querySelectorAll('.chart-toggles input').forEach(input =>
        input.addEventListener('change', redraw));
    bindHover('rotation-chart', 'rotation-chart-tooltip', 'dps');
    bindHover('rotation-effects-chart', 'rotation-effects-tooltip', 'effects');
    redraw();
    requestAnimationFrame(redraw);
}

const MESMER_SKILL_COLS = [
    { key: 'name', label: 'Skill', numeric: false },
    { key: 'strike', label: 'Strike', numeric: true },
    { key: 'condition', label: 'Condition', numeric: true },
    { key: 'total', label: 'Total', numeric: true },
    { key: 'dps', label: 'DPS', numeric: true },
    { key: 'average', label: 'Avg/Cast', numeric: true },
    { key: 'dct', label: 'DCT', numeric: true },
    { key: 'casts', label: 'Casts', numeric: true },
    { key: 'hits', label: 'Hits', numeric: true },
];

function renderSkillRow(app, row, number) {
    return `<div class="res-row">
        <span class="res-skill"><img src="${esc(resultIcon(app, row))}" alt="" />${esc(row.name)}</span>
        <span>${number(row.strike)}</span>
        <span class="condi">${number(row.condition)}</span>
        <span class="total">${number(row.total)}</span>
        <span class="dps">${number(row.dps)}</span>
        <span>${row.average == null ? '&mdash;' : number(row.average)}</span>
        <span>${row.dct == null ? '&mdash;' : number(row.dct)}</span>
        <span>${row.casts}</span>
        <span>${row.hits}</span>
    </div>`;
}

function applySkillBreakdownSort(element, app, number) {
    const { skillRows } = app._skillBreakdownState;
    const col = app._skillSortCol;
    const dir = app._skillSortDir;
    const sorted = [...skillRows];
    if (col && dir) {
        const colDef = MESMER_SKILL_COLS.find(c => c.key === col);
        if (colDef?.numeric) {
            sorted.sort((a, b) => {
                const av = a[col] ?? -Infinity;
                const bv = b[col] ?? -Infinity;
                return dir === 'asc' ? av - bv : bv - av;
            });
        } else {
            sorted.sort((a, b) => dir === 'asc'
                ? String(a[col]).localeCompare(String(b[col]))
                : String(b[col]).localeCompare(String(a[col])));
        }
    } else {
        sorted.sort((a, b) => b.total - a.total);
    }
    const rowsEl = element.querySelector('.mesmer-skill-breakdown .res-skill-rows');
    if (rowsEl) rowsEl.innerHTML = sorted.map(row => renderSkillRow(app, row, number)).join('');

    const hdr = element.querySelector('.mesmer-skill-breakdown .res-hdr-sortable');
    if (hdr) {
        hdr.querySelectorAll('span[data-sort-col]').forEach(span => {
            const key = span.dataset.sortCol;
            const isActive = app._skillSortCol === key;
            const indicator = isActive ? (app._skillSortDir === 'asc' ? ' ▲' : ' ▼') : '';
            const colDef = MESMER_SKILL_COLS.find(c => c.key === key);
            span.textContent = (colDef?.label ?? key) + indicator;
        });
    }
}

function bindSkillBreakdownSort(element, app, number) {
    const hdr = element.querySelector('.mesmer-skill-breakdown .res-hdr-sortable');
    if (!hdr) return;
    hdr.querySelectorAll('span[data-sort-col]').forEach(span => {
        span.addEventListener('click', () => {
            const col = span.dataset.sortCol;
            if (app._skillSortCol === col) {
                app._skillSortDir = app._skillSortDir === 'desc' ? 'asc' : app._skillSortDir === 'asc' ? null : 'desc';
            } else {
                app._skillSortDir = 'desc';
            }
            app._skillSortCol = app._skillSortDir ? col : null;
            applySkillBreakdownSort(element, app, number);
        });
    });
}

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
    const number = value => Math.round(Number(value || 0)).toLocaleString();

    const sortIndicator = (col) => {
        if (!app._skillSortCol || app._skillSortCol !== col) return '';
        return app._skillSortDir === 'asc' ? ' ▲' : ' ▼';
    };

    element.innerHTML = `<div class="res-summary">
        ${metrics.map(metric => `<div class="res-stat">
            <span class="res-label">${metric.label}</span>
            <span class="res-val${metric.className ? ` ${metric.className}` : ''}">${metric.value}</span>
        </div>`).join('')}
    </div>
    <div class="res-breakdown mesmer-skill-breakdown">
        <div class="res-hdr res-hdr-sortable">
            ${MESMER_SKILL_COLS.map(col =>
                `<span data-sort-col="${col.key}">${col.label}${sortIndicator(col.key)}</span>`
            ).join('')}
        </div>
        <div class="res-skill-rows">
            ${skillRows.map(row => renderSkillRow(app, row, number)).join('')}
        </div>
    </div>
    ${conditions.length ? `<div class="res-breakdown cond-breakdown">
        <div class="res-hdr cond-hdr">
            <span>Condition</span><span>Damage</span><span>DPS</span><span>Avg Stacks</span>
        </div>
        ${conditions.map(condition => `<div class="res-row">
            <span class="res-skill condi">${esc(condition.name)}</span>
            <span class="condi">${number(condition.damage)}</span>
            <span class="dps">${number(condition.dps)}</span>
            <span>${Number(condition.averageStacks || 0).toFixed(2)}</span>
        </div>`).join('')}
        <div class="res-row res-total">
            <span class="res-skill"><b>Total Conditions</b></span>
            <span class="condi"><b>${number(result.conditionDamage)}</b></span>
            <span class="dps"><b>${number(result.conditionDamage / Math.max(0.001, result.duration))}</b></span>
            <span></span>
        </div>
    </div>` : ''}
    ${chartHtml(series)}
    ${result.warnings.length ? `<div class="sim-warnings">${result.warnings.map(esc).join('<br>')}</div>` : ''}`;
    bindCharts(element, series);
    app._skillBreakdownState = { skillRows };
    bindSkillBreakdownSort(element, app, number);
}

export function renderRotationBuilder(app) {
    renderStartResource(app);
    renderPalette(app);
    renderTimeline(app);
    renderEventLog(app);
    renderResults(app);
}
