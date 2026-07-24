// ─── dps.report / Elite Insights rotation importer ───────────────────────────
//
// Converts the Elite Insights JSON (fetched via the dps.report API) into the
// tool's native rotation array format.
//
// Public API:
//   extractLogId(url)                             → string | null
//   fetchEIJson(logId)                            → Promise<object>
//   findElementalistPlayers(eiJson)               → player[]
//   convertEIRotation(eiJson, player, toolSkillNames) → item[]

const ELEMENTALIST_SPECS = new Set([
    'Elementalist', 'Weaver', 'Tempest', 'Catalyst', 'Evoker',
]);

// Channeled skills whose actual cast duration determines how many hits land.
// Key = EI skill name, value = duration threshold (ms).  If the actual
// cast.duration is below this threshold, the cast is treated as interrupted
// so the tool simulates fewer hits.
const SHORTENABLE_SKILLS = new Map([
    ['Flamestrike', 440],   // Scepter Fire 1 — 2 hits over 600ms channel
    ['Arc Lightning', 2600],  // Scepter Air 1  — 10 hits over 2720ms channel
]);

// Skills whose tool name requires a current-attunement suffix.
// These skills keep the same base name in EI but need "(Fire)" / "(Air)" etc.
const ATTUNEMENT_SUFFIX_SKILLS = new Set([
    'Glyph of Elemental Power',
    'Primordial Stance',
    'Deploy Jade Sphere',
]);

// Chain skills that EI logs under a single name but the tool splits into
// numbered variants.  Each entry maps the EI name to the ordered list of
// tool names in the chain.  Consecutive casts of the same EI name cycle
// through the list; the cycle resets after a gap (> CHAIN_RESET_MS) or an
// attunement swap.
const CHAIN_SKILLS = new Map([
    ['Aerial Agility', [
        'Aerial Agility',
        'Aerial Agility (chain)',
        'Aerial Agility (dash)',
    ]],
]);
const CHAIN_RESET_MS = 4000;

// Direct EI skill name → tool skill name overrides.
// Used when EI reports a completely different name than the tool uses,
// typically because the in-game skill name changes per attunement.
const EI_NAME_MAP = {
    // Glyph of Storms — EI uses the attunement-specific cast names.
    'Firestorm': 'Glyph of Storms (Fire)',
    'Ice Storm': 'Glyph of Storms (Water)',
    'Lightning Storm': 'Glyph of Storms (Air)',
    'Sandstorm': 'Glyph of Storms (Earth)',
};

// ─── URL / ID helpers ────────────────────────────────────────────────────────

/**
 * Extract the log ID from a dps.report permalink.
 * Accepts:
 *   https://dps.report/AATE-20260118-105514_golem
 *   https://b.dps.report/AATE-20260118-105514_golem
 *   AATE-20260118-105514_golem   (bare ID)
 */
export function extractLogId(url) {
    url = url.trim();
    const m = url.match(/([A-Za-z0-9]{4}-\d{8}-\d{6}_\w+)/);
    return m ? m[1] : null;
}

// ─── Network ─────────────────────────────────────────────────────────────────

export async function fetchEIJson(logId) {
    const endpoint = `https://dps.report/getJson?permalink=https://dps.report/${logId}`;
    let res;
    try {
        res = await fetch(endpoint);
    } catch (e) {
        throw new Error(`Network error fetching dps.report: ${e.message}`);
    }
    if (!res.ok) throw new Error(`dps.report returned HTTP ${res.status}. Is the URL correct?`);
    const json = await res.json();
    if (json.error) throw new Error(`dps.report error: ${json.error}`);
    return json;
}

// ─── Player selection ────────────────────────────────────────────────────────

export function findElementalistPlayers(eiJson) {
    return (eiJson.players || []).filter(p => ELEMENTALIST_SPECS.has(p.profession));
}

// ─── Core conversion ─────────────────────────────────────────────────────────

/**
 * Convert an EI player rotation into the tool's rotation item array.
 *
 * @param {object}   eiJson            - Full Elite Insights JSON from dps.report
 * @param {object}   player            - Player entry from eiJson.players[]
 * @param {Set}      toolSkillNames    - Set of all skill names the tool knows (from CSV)
 * @param {Map}      skillAttunements  - Map of tool skill name → attunement string (from CSV)
 * @param {string[]} [weapons]         - Current build weapons, e.g. ['Scepter','Focus']
 * @returns {Array} Rotation items — strings, { name, offset }, { name, interruptMs }, or { name: '__wait', waitMs }
 */
export function convertEIRotation(eiJson, player, toolSkillNames, skillAttunements = new Map(), weapons = []) {
    const skillMap = eiJson.skillMap || {};

    // 1. Flatten all casts from the per-skill-id grouping into a single list.
    const allCasts = [];
    for (const se of (player.rotation || [])) {
        const info = skillMap['s' + se.id] || {};

        // Skip procs that fire automatically — the player didn't press these.
        if (info.isTraitProc || info.isUnconditionalProc || info.isGearProc) continue;

        for (const cast of se.skills) {
            const timeGained = cast.timeGained ?? 0;
            const cleanName = (info.name || '').replace(/^"|"$/g, '');
            const cancelled = timeGained < 0;
            const shortenThreshold = SHORTENABLE_SKILLS.get(cleanName);
            const shortened = !cancelled
                && shortenThreshold !== undefined
                && cast.duration < shortenThreshold;
            allCasts.push({
                name: cleanName,
                castTime: cast.castTime,
                duration: cast.duration,
                isInstant: !!(info.isInstantCast || cast.duration === 0),
                isSwap: !!info.isSwap,
                isInterrupted: cancelled || shortened,
            });
        }
    }
    allCasts.sort((a, b) => a.castTime - b.castTime);

    // Resolve chain skills: rename consecutive same-name casts to their
    // tool chain variants (e.g. Aerial Agility → chain → dash).
    resolveChainSkills(allCasts);

    // Inject missing aura skill casts inferred from unattributed aura buff activations.
    injectAuraCasts(allCasts, player, toolSkillNames, weapons);

    // Inject Blinding Flash from target Blind+Weakness co-application.
    injectBlindingFlash(allCasts, eiJson, toolSkillNames, weapons);

    // 2. Walk chronologically and emit rotation items.
    const items = [];
    // Infer the starting primary attunement from the first identifiable pre-swap skill.
    let currentElement = inferStartingElement(allCasts, skillAttunements);
    let anchor = null; // { castTime, endTime } of the current non-instant cast window

    for (const cast of allCasts) {
        const toolName = resolveToolName(cast, currentElement, toolSkillNames);

        // Update attunement tracking whenever we see a swap.
        if (cast.isSwap) {
            currentElement = extractElement(toolName);
        }

        const known = toolSkillNames.has(toolName);

        if (cast.isInterrupted) {
            // ── Interrupted cast ──────────────────────────────────────────────
            if (known) {
                items.push({ name: toolName, interruptMs: cast.duration });
            } else if (cast.duration > 0) {
                items.push({ name: '__wait', waitMs: cast.duration });
            }
            // Interrupted casts don't define a valid concurrent window.
            anchor = null;

        } else if (cast.isInstant) {
            // ── Instant-cast skill ────────────────────────────────────────────
            const inWindow = anchor
                && cast.castTime >= anchor.castTime
                && cast.castTime < anchor.endTime;

            if (inWindow) {
                // Fires during the previous non-instant's animation → concurrent.
                if (known) {
                    items.push({ name: toolName, offset: Math.max(1, cast.castTime - anchor.castTime) });
                }
                // Unknown instants inside the window are silently skipped
                // (they're likely minor procs that slipped through the filter).
            } else {
                // Fires between casts → standalone instant.
                if (known) items.push(toolName);
                anchor = null;
            }

        } else {
            // ── Normal (non-instant) cast ─────────────────────────────────────
            if (known) {
                items.push(toolName);
            } else if (cast.duration > 0) {
                items.push({ name: '__wait', waitMs: cast.duration });
            }
            anchor = { castTime: cast.castTime, endTime: cast.castTime + cast.duration };
        }
    }

    return items;
}

// ─── Chain skill resolution ───────────────────────────────────────────────────

/**
 * Walk the sorted allCasts list and rename chain-skill casts to their tool
 * variants.  EI logs every press as the same base name; the tool needs the
 * ordered chain names.
 *
 * The chain index resets when:
 *   - A different skill (or an attunement swap) is cast between chain presses
 *   - More than CHAIN_RESET_MS has elapsed since the previous chain cast
 *
 * Mutates cast.name in place.
 */
function resolveChainSkills(allCasts) {
    // Per EI base name: track { idx, lastTime }
    const state = new Map();

    for (const cast of allCasts) {
        const eiName = cast.name;
        const chain = CHAIN_SKILLS.get(eiName);
        if (!chain) {
            // Any non-chain cast resets all running chains.
            if (state.size > 0) state.clear();
            continue;
        }

        const prev = state.get(eiName);
        let idx = 0;
        if (prev && (cast.castTime - prev.lastTime) <= CHAIN_RESET_MS) {
            idx = (prev.idx + 1) % chain.length;
        }

        cast.name = chain[idx];
        state.set(eiName, { idx, lastTime: cast.castTime });
    }
}

// ─── Aura injection ───────────────────────────────────────────────────────────

const AURA_WINDOW_MS = 1500;

// Each aura skill that arcdps does not log cast events for.
//
//   buffId       — EI buff ID for the aura effect
//   skillName    — tool skill name to inject
//   weaponReq    — weapon that must be equipped for this skill to exist
//   weaponSlot   — 'mh' (index 0) or 'oh' (index 1); needed because Dagger
//                  can sit in either slot and the aura skill differs
//   swapElement  — swapping TO this element is a known source (Sunspot trait)
//   baseSources  — EI skill names that always grant this aura (non-weapon)
//   pistolSources — additional sources only relevant when Pistol is equipped
const AURA_CONFIG = [
    {
        buffId: 5677,
        skillName: 'Fire Shield',
        weaponReq: 'Focus',
        weaponSlot: 'oh',
        swapElement: 'Fire',
        baseSources: new Set([
            'Feel the Burn!', 'Signet of Fire', 'Conflagration', 'Overload Fire',
        ]),
        pistolSources: new Set([
            'Elemental Explosion', 'Searing Salvo', 'Frostfire Flurry',
        ]),
    },
    {
        buffId: 5579,
        skillName: 'Frost Aura',
        weaponReq: 'Dagger',
        weaponSlot: 'oh',
        swapElement: null,
        baseSources: new Set([
            'Overload Water',
        ]),
        pistolSources: new Set([
            'Elemental Explosion', 'Flowing Finesse',
        ]),
    },
    {
        buffId: 5577,
        skillName: 'Shocking Aura',
        weaponReq: 'Dagger',
        weaponSlot: 'mh',
        swapElement: null,
        baseSources: new Set([
            'Overload Air',
        ]),
        pistolSources: null,
    },
    {
        buffId: 5684,
        skillName: 'Magnetic Aura',
        weaponReq: 'Staff',
        weaponSlot: 'mh',
        swapElement: null,
        baseSources: new Set([
            'Overload Earth', 'Aftershock!', 'Signet of Earth',
        ]),
        pistolSources: null,
    },
];

/**
 * Splice missing aura skill casts into allCasts by detecting buff activations
 * that have no other known aura-granting skill nearby.
 *
 * arcdps does not emit cast events for these instant aura skills, so they
 * never appear in the EI rotation.  We detect them from the corresponding
 * aura buff (buffUptimes.states): any 0→1 transition at t ≥ 0 that has no
 * known source within ±AURA_WINDOW_MS is attributed to the missing skill.
 *
 * Each aura is only considered if the build has the required weapon equipped.
 *
 * @param {Array}    allCasts       – mutable cast list
 * @param {object}   player         – EI player entry
 * @param {Set}      toolSkillNames – all known tool skill names
 * @param {string[]} weapons        – current build weapons, e.g. ['Scepter','Focus']
 */
function injectAuraCasts(allCasts, player, toolSkillNames, weapons) {
    const buffUptimes = player.buffUptimes || [];
    const mh = (weapons[0] || '').toLowerCase();
    const oh = (weapons[1] || '').toLowerCase();
    const hasPistol = mh === 'pistol' || oh === 'pistol';
    let anyInjected = false;

    for (const cfg of AURA_CONFIG) {
        // Weapon precondition — check the correct slot (MH / OH).
        const reqLower = cfg.weaponReq.toLowerCase();
        const slotWeapon = cfg.weaponSlot === 'mh' ? mh : oh;
        if (slotWeapon !== reqLower) continue;
        if (!toolSkillNames.has(cfg.skillName)) continue;

        const auraBuff = buffUptimes.find(b => b.id === cfg.buffId);
        if (!auraBuff?.states) continue;

        // Build the effective source set for this build.
        const sources = new Set(cfg.baseSources);
        if (hasPistol && cfg.pistolSources) {
            for (const s of cfg.pistolSources) sources.add(s);
        }

        // Collect 0→1 transitions; skip t < 0 (pre-fight pre-casts).
        const activations = [];
        let prev = 0;
        for (const [t, state] of auraBuff.states) {
            if (prev === 0 && state === 1 && t >= 0) activations.push(t);
            prev = state;
        }

        for (const t of activations) {
            const hasKnownSource = allCasts.some(c => {
                if (Math.abs(c.castTime - t) > AURA_WINDOW_MS) return false;
                // Attunement swap granting aura via Sunspot / trait
                if (cfg.swapElement && c.isSwap
                    && resolveAttunementSwap(c.name) === `${cfg.swapElement} Attunement`) {
                    return true;
                }
                return sources.has(c.name);
            });

            if (!hasKnownSource) {
                allCasts.push({
                    name: cfg.skillName,
                    castTime: t,
                    duration: 0,
                    isInstant: true,
                    isSwap: false,
                    isInterrupted: false,
                });
                anyInjected = true;
            }
        }
    }

    if (anyInjected) allCasts.sort((a, b) => a.castTime - b.castTime);
}

// ─── Blinding Flash injection ─────────────────────────────────────────────────

const BLIND_BUFF_ID = 720;
const WEAKNESS_BUFF_ID = 742;
const BF_COOCCUR_MS = 100; // max gap between Blind and Weakness to count as simultaneous
const BF_WINDOW_MS = 1000;

// Skills that apply Blind and could be mistaken for Blinding Flash.
const BF_BLIND_SOURCES = new Set(['Dust Devil', 'Dust Storm']);
// Skills that apply Weakness and could be mistaken for Blinding Flash.
const BF_WEAK_SOURCES = new Set(['Lightning Blitz']);

/**
 * Detect Blinding Flash casts from simultaneous Blind + Weakness applications
 * on the target.  arcdps does not log Blinding Flash as a cast.
 *
 * Only runs when Scepter is the mainhand weapon.
 *
 * A co-occurrence is attributed to Blinding Flash unless BOTH a known blind
 * source AND a known weakness source are cast within ±BF_WINDOW_MS (which
 * would fully explain the co-occurrence without Blinding Flash).
 *
 * On golem logs with permanent conditions there will be no 0→1 transitions,
 * so this gracefully does nothing.
 */
function injectBlindingFlash(allCasts, eiJson, toolSkillNames, weapons) {
    if (!toolSkillNames.has('Blinding Flash')) return;
    const mh = (weapons[0] || '').toLowerCase();
    if (mh !== 'scepter') return;

    // Collect 0→1 transition times for Blind and Weakness across all targets.
    const blindTimes = new Set();
    const weakTimes = new Set();
    for (const target of (eiJson.targets || [])) {
        for (const buff of (target.buffs || [])) {
            const set = buff.id === BLIND_BUFF_ID ? blindTimes
                : buff.id === WEAKNESS_BUFF_ID ? weakTimes
                    : null;
            if (!set || !buff.states) continue;
            let prev = 0;
            for (const [t, state] of buff.states) {
                if (prev === 0 && state >= 1 && t >= 0) set.add(t);
                prev = state;
            }
        }
    }
    // Need at least one condition to have transitions.
    if (blindTimes.size === 0 && weakTimes.size === 0) return;

    // Build candidate times.  When both conditions have data, require
    // co-occurrence (both within ±BF_COOCCUR_MS).  When one condition is
    // perma-active (no transitions), the other alone is sufficient.
    const hasBlindData = blindTimes.size > 0;
    const hasWeakData = weakTimes.size > 0;
    const candidates = new Set();

    if (hasBlindData && hasWeakData) {
        // Both available — require co-occurrence.
        const weakArr = [...weakTimes].sort((a, b) => a - b);
        let wi = 0;
        for (const bt of [...blindTimes].sort((a, b) => a - b)) {
            while (wi < weakArr.length && weakArr[wi] < bt - BF_COOCCUR_MS) wi++;
            if (wi < weakArr.length && Math.abs(weakArr[wi] - bt) <= BF_COOCCUR_MS) {
                candidates.add(bt);
            }
        }
    } else if (hasBlindData) {
        // Only Blind transitions (Weakness is perma) — each Blind is a candidate.
        for (const t of blindTimes) candidates.add(t);
    } else {
        // Only Weakness transitions (Blind is perma) — each Weakness is a candidate.
        for (const t of weakTimes) candidates.add(t);
    }
    if (candidates.size === 0) return;

    let anyInjected = false;
    for (const t of candidates) {
        const hasBlindSource = allCasts.some(c =>
            BF_BLIND_SOURCES.has(c.name) && Math.abs(c.castTime - t) <= BF_WINDOW_MS);
        const hasWeakSource = allCasts.some(c =>
            BF_WEAK_SOURCES.has(c.name) && Math.abs(c.castTime - t) <= BF_WINDOW_MS);

        // When both conditions have transition data, suppress only if both are
        // fully explained by other skills.  When one condition is perma (no
        // transitions), suppress if the available condition's source is nearby.
        if (hasBlindData && hasWeakData && hasBlindSource && hasWeakSource) continue;
        if (hasBlindData && !hasWeakData && hasBlindSource) continue;
        if (!hasBlindData && hasWeakData && hasWeakSource) continue;

        allCasts.push({
            name: 'Blinding Flash',
            castTime: t,
            duration: 0,
            isInstant: true,
            isSwap: false,
            isInterrupted: false,
        });
        anyInjected = true;
    }

    if (anyInjected) allCasts.sort((a, b) => a.castTime - b.castTime);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Infer the starting primary attunement by scanning the first skills used
 * before the first attunement swap.
 *
 * Priority order per cast:
 *   1. EI_NAME_MAP hit whose resolved name ends in "(Element)" — e.g.
 *      "Lightning Storm" → "Glyph of Storms (Air)" → element = "Air"
 *   2. CSV attunement for the raw EI name, if it is a single element (no "+")
 *
 * Falls back to "Fire" if no clear signal is found.
 */
function inferStartingElement(allCasts, skillAttunements) {
    for (const cast of allCasts) {
        if (cast.isSwap) break; // stop looking once the first swap occurs

        // 1. EI_NAME_MAP: resolved name may embed the attunement as a suffix.
        const mapped = EI_NAME_MAP[cast.name];
        if (mapped) {
            const m = mapped.match(/\((\w+)\)$/);
            if (m) return m[1];
        }

        // 2. CSV attunement for the raw EI name (covers skills whose name
        //    matches between EI and the tool, e.g. "Derecho" → "Air").
        const att = skillAttunements.get(cast.name);
        if (att && !att.includes('+')) return att;
    }
    return 'Fire';
}

/**
 * Map an EI cast's name to the tool's skill name.
 *
 * Priority order:
 *   1. Direct EI_NAME_MAP override (e.g. "Lightning Storm" → "Glyph of Storms (Air)")
 *   2. Attunement swap resolution ("Earth Fire Attunement" → "Earth Attunement")
 *   3. Attunement-suffix appending ("Primordial Stance" → "Primordial Stance (Air)")
 *   4. Identity (name used as-is)
 */
function resolveToolName(cast, currentElement, toolSkillNames) {
    if (EI_NAME_MAP[cast.name]) return EI_NAME_MAP[cast.name];
    if (cast.isSwap) return resolveAttunementSwap(cast.name);
    if (ATTUNEMENT_SUFFIX_SKILLS.has(cast.name)) {
        const candidate = `${cast.name} (${currentElement})`;
        return toolSkillNames.has(candidate) ? candidate : cast.name;
    }
    return cast.name;
}

/**
 * Convert an EI attunement swap name to the tool's simple "X Attunement".
 *
 * EI formats:
 *   "Dual Fire Attunement"   → new primary = Fire
 *   "Earth Fire Attunement"  → new primary = Earth  (first word)
 */
function resolveAttunementSwap(eiName) {
    // "Dual X Attunement" → "X Attunement"
    let m = eiName.match(/^Dual (\w+) Attunement$/);
    if (m) return `${m[1]} Attunement`;

    // "X Y Attunement" → "X Attunement"  (X = new primary)
    m = eiName.match(/^(\w+) \w+ Attunement$/);
    if (m) return `${m[1]} Attunement`;

    return eiName;
}

/** "Fire Attunement" → "Fire" */
function extractElement(attunementToolName) {
    return attunementToolName.replace(' Attunement', '');
}
