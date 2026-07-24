function parseCSV(text) {
    const rows = [];
    for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        const row = [];
        let field = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (line[i + 1] === '"') { field += '"'; i++; }
                    else inQuotes = false;
                } else {
                    field += ch;
                }
            } else {
                if (ch === '"') inQuotes = true;
                else if (ch === ',') { row.push(field.trim()); field = ''; }
                else if (ch !== '\r') field += ch;
            }
        }
        row.push(field.trim());
        rows.push(row);
    }
    return rows;
}

function num(val) {
    if (!val) return 0;
    const cleaned = val.replace('%', '').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

function parseStacksDuration(val) {
    if (!val) return null;
    val = val.trim();
    if (!val) return null;
    if (val.includes('|')) {
        const [s, d] = val.split('|');
        return { stacks: num(s), duration: num(d) };
    }
    const n = num(val);
    return n > 0 ? { stacks: 1, duration: n } : null;
}


// ─── Skills_data.csv ───
export function loadSkills(text) {
    const rows = parseCSV(text);
    const headers = rows[0];
    const skills = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue;
        const skill = {};
        for (let j = 0; j < headers.length; j++) {
            skill[headers[j]] = row[j] || '';
        }
        skills.push({
            name: skill['Name'],
            type: skill['Type'],
            slot: skill['Slot'],
            attunement: skill['Attunement'],
            weapon: skill['Weapon'],
            chainSkill: skill['Chain skill'],
            castTime: num(skill['Cast Time']),
            recharge: num(skill['Recharge']),
            countRecharge: num(skill['Count Recharge']),
            maximumCount: num(skill['Maximum Count']),
            comboField: skill['Combo Field'],
            duration: num(skill['Duration']),
            aura: skill['Aura'],
            endurance: num(skill['Endurance']),
        });
    }
    return skills;
}

// ─── Skill_hits_data.csv ───
const CONDITION_COLS = [
    'Burning', 'Bleeding', 'Blindness', 'Vulnerability', 'Chilled',
    'Regeneration', 'Swiftness', 'Superspeed', 'Weakness', 'Cripple',
    'Stability', 'Immobilize', 'Vigor', 'Resistance', 'Fury', 'Might',
    'Protection', 'Boon Extension', 'Quickness', 'Aegis', 'Resolution'
];

export function loadSkillHits(text) {
    const rows = parseCSV(text);
    const headers = rows[0];
    const hitMap = {};

    const colIndex = {};
    headers.forEach((h, i) => colIndex[h] = i);

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = row[0];
        if (!name) continue;

        const conditions = {};
        for (const col of CONDITION_COLS) {
            const idx = colIndex[col];
            if (idx !== undefined) {
                const parsed = parseStacksDuration(row[idx]);
                if (parsed) conditions[col] = parsed;
            }
        }

        let comboFinisher = row[colIndex['Combo Finisher']] || '';
        let finisherType = '', finisherValue = 0;
        if (comboFinisher) {
            if (comboFinisher.includes('|')) {
                const parts = comboFinisher.split('|');
                finisherType = parts[0];
                finisherValue = num(parts[1]);
            } else {
                finisherType = comboFinisher;
                finisherValue = 1;
            }
        }

        const hit = {
            name,
            startOffsetMs: num(row[colIndex['start_offset_ms']]),
            repeatOffsetMs: num(row[colIndex['repeat_offset_ms']]),
            hit: num(row[colIndex['Hit']]),
            numberOfImpacts: row[colIndex['Number of Impacts']]?.trim() || '',
            isFieldTick: row[colIndex['IsFieldTick']]?.trim() === '1',
            cc: row[colIndex['CC']]?.trim() === '1',
            damage: num(row[colIndex['Damage']]),
            flatDamage: num(row[colIndex['Flat Damage']]),
            duration: num(row[colIndex['Duration']]),
            interval: num(row[colIndex['Interval']]),
            finisherType,
            finisherValue,
            conditions,
        };

        if (!hitMap[name]) hitMap[name] = [];
        hitMap[name].push(hit);
    }
    return hitMap;
}


// ─── Load all CSVs ───
const CSV_DIR = 'csv input';
const CSV_FILES = {
    skills:    'Tool_Elementalist - Skills_data.csv',
    skillHits: 'Tool_Elementalist - Skill_hits_data.csv',
};

async function fetchCSV(filename) {
    const path = encodeURI(`${CSV_DIR}/${filename}`);
    const resp = await fetch(`${path}?t=${Date.now()}`);
    if (!resp.ok) throw new Error(`Failed to load ${path}: ${resp.status}`);
    return resp.text();
}

export async function loadAllData() {
    const texts = {};
    for (const [key, file] of Object.entries(CSV_FILES)) {
        texts[key] = await fetchCSV(file);
    }

    return {
        skills:    loadSkills(texts.skills),
        skillHits: loadSkillHits(texts.skillHits),
    };
}
