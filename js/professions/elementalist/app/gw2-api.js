const API_BASE = 'https://api.guildwars2.com/v2';
const CACHE_KEY = 'gw2_icon_cache_v21';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const EXTRA_ELEM_SKILL_IDS = [
    // Tempest: overloads, shouts
    29415, 29535, 29548, 29618, 29706, 29719, 29948, 29968, 30008, 30047, 30336, 30432, 30662,
    30446, 30795, 30864, 29453,
    // Glyph variants, Weaver/Catalyst/Evoker skills
    34609, 34637, 34651, 34714, 34724, 34736, 34743, 34772,
    35304, 37873, 40229, 40326, 43080, 43199, 43657, 44637, 44918, 45216, 45259, 45983, 46024,
    49056, 50447, 51646, 51662, 51684, 51711,
    62694, 62723, 62813, 62837, 62862, 62876, 62940, 65179, 71796, 71907,
    // Evoker familiars: Ignite, Splash, Zap, Calcify
    76643, 77225, 77370, 77226,
    // Conjured weapons: Frost Bow, Lightning Hammer, Fiery Greatsword
    5517, 5531, 5532, 5533, 5568, 5595, 5625, 5697, 5720, 5721, 5723, 5725, 5726, 5727, 5728, 5733,
];

export class GW2API {
    constructor() {
        this.skillIcons = {};
        this.traitIcons = {};
        this.specData = {};
        this.ready = false;
    }

    async init() {
        if (this._loadCache()) {
            this.ready = true;
            return;
        }
        try {
            await this._fetchAll();
            this._saveCache();
            this.ready = true;
        } catch (e) {
            console.warn('GW2 API fetch failed, icons will use placeholders:', e);
        }
    }

    _loadCache() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (Date.now() - data.ts > CACHE_TTL) return false;
            this.skillIcons = data.skillIcons || {};
            this.traitIcons = data.traitIcons || {};
            this.specData = data.specData || {};
            return true;
        } catch { return false; }
    }

    _saveCache() {
        const data = {
            ts: Date.now(),
            skillIcons: this.skillIcons,
            traitIcons: this.traitIcons,
            specData: this.specData,
        };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { }
    }

    async _fetchJSON(url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`API ${r.status}: ${url}`);
        return r.json();
    }

    async _fetchBatch(endpoint, ids) {
        const results = [];
        for (let i = 0; i < ids.length; i += 200) {
            const batch = ids.slice(i, i + 200).join(',');
            const data = await this._fetchJSON(`${API_BASE}/${endpoint}?ids=${batch}`);
            results.push(...data);
        }
        return results;
    }

    async _fetchAll() {
        const prof = await this._fetchJSON(`${API_BASE}/professions/Elementalist`);

        const skillIds = new Set();
        for (const s of (prof.skills || [])) {
            skillIds.add(typeof s === 'object' ? s.id : s);
        }
        for (const [, weaponInfo] of Object.entries(prof.weapons || {})) {
            for (const s of (weaponInfo.skills || [])) {
                skillIds.add(s.id);
            }
        }
        for (const track of (prof.training || [])) {
            for (const item of (track.track || [])) {
                if (item.type === 'Skill' && item.skill_id) skillIds.add(item.skill_id);
            }
        }

        const specIds = prof.specializations || [];
        const specs = await this._fetchBatch('specializations', specIds);

        // Wiki specialization backgrounds are exactly 647×136 px — ideal for our panel width.
        // Special:FilePath redirects to the actual file regardless of internal hash paths.
        const WIKI_BG = {
            'Fire': 'https://wiki.guildwars2.com/wiki/Special:FilePath/Fire_specialization.png',
            'Water': 'https://wiki.guildwars2.com/wiki/Special:FilePath/Water_specialization.png',
            'Air': 'https://wiki.guildwars2.com/wiki/Special:FilePath/Air_specialization.png',
            'Earth': 'https://wiki.guildwars2.com/wiki/Special:FilePath/Earth_specialization.png',
            'Arcane': 'https://wiki.guildwars2.com/wiki/Special:FilePath/Arcane_specialization.png',
            'Tempest': 'https://wiki.guildwars2.com/wiki/Special:FilePath/Tempest_specialization.png',
            'Weaver': 'https://wiki.guildwars2.com/wiki/Special:FilePath/Weaver_specialization.png',
            'Catalyst': 'https://wiki.guildwars2.com/wiki/Special:FilePath/Catalyst_specialization.png',
            'Evoker': 'https://wiki.guildwars2.com/wiki/Special:FilePath/Evoker_specialization.png',
        };

        const traitIds = new Set();
        for (const spec of specs) {
            this.specData[spec.name] = {
                id: spec.id,
                icon: spec.icon || '',
                background: WIKI_BG[spec.name] || spec.background || '',
                elite: spec.elite || false,
                minorTraits: spec.minor_traits || [],
                majorTraits: spec.major_traits || [],
            };
            for (const t of [...(spec.minor_traits || []), ...(spec.major_traits || [])]) {
                traitIds.add(t);
            }
            if (spec.elite && spec.skills_by_palette) {
                for (const s of spec.skills_by_palette) skillIds.add(s[1]);
            }
        }

        for (const id of EXTRA_ELEM_SKILL_IDS) skillIds.add(id);

        const skills = await this._fetchBatch('skills', [...skillIds]);
        for (const s of skills) {
            this.skillIcons[s.name] = s.icon || '';
        }

        const traits = await this._fetchBatch('traits', [...traitIds]);
        for (const t of traits) {
            this.traitIcons[t.name] = t.icon || '';
        }

        this.skillIcons['Deploy Jade Sphere (Fire)'] = 'https://render.guildwars2.com/file/22CA7C0F420C7F61CEBFA323DF3AADC5EF237475/2491598.png';
        this.skillIcons['Deploy Jade Sphere (Water)'] = 'https://render.guildwars2.com/file/6016319AAF18417F0401800EF36C0F18E207FFD5/2491600.png';
        this.skillIcons['Deploy Jade Sphere (Air)'] = 'https://render.guildwars2.com/file/07D9C76FEB07BB04B9D07A05D87C09A0A0AE0319/2491594.png';
        this.skillIcons['Deploy Jade Sphere (Earth)'] = 'https://render.guildwars2.com/file/97BEF22148DDA3159B4CF6DB18ECFEDE7107710B/2491596.png';
        this.skillIcons['Hurl'] = 'https://render.guildwars2.com/file/BB59A576C805054EB94C66D8190490F273C7BBED/102974.png';
        this.skillIcons['Glyph of Elemental Power (Fire)'] = 'https://render.guildwars2.com/file/0805084EF739CEDD5C9678561C331D7F0B01590B/1424236.png';
        this.skillIcons['Glyph of Elemental Power (Water)'] = 'https://render.guildwars2.com/file/BB18F50D1F7E7F59BFCBC521F6EBD9754522B22D/1424237.png';
        this.skillIcons['Glyph of Elemental Power (Air)'] = 'https://render.guildwars2.com/file/B4E00C980DE7F1CB0BE62F3901EB031067F302F3/1424234.png';
        this.skillIcons['Glyph of Elemental Power (Earth)'] = 'https://render.guildwars2.com/file/C8AEFA0A46F573F37E7902257772AD9A5E742BBD/1424235.png';
        this.skillIcons['Grand Finale'] = 'https://render.guildwars2.com/file/41D40EDB66D0CC0A73F405630803D2D600CABCCE/2491580.png';
        this.skillIcons['Etching: Volcano'] = 'https://render.guildwars2.com/file/037DCBFCCD3BA4C3ACC7B73DF4965D3A170F0F3E/3379099.png';
        this.skillIcons['Etching: Jökulhlaup'] = 'https://render.guildwars2.com/file/3333FBE3CB1331A40AC51903580FCFB09BC80335/3379103.png';
        this.skillIcons['Etching: Derecho'] = 'https://render.guildwars2.com/file/F1B3331AB23F37964BE8D6A91F43FF066BE970AA/3379093.png';
        this.skillIcons['Etching: Haboob'] = 'https://render.guildwars2.com/file/7C7339E9EA33F7CD05806CE20066DF0EC4673767/3379096.png';
        this.skillIcons['Lesser Volcano'] = 'https://render.guildwars2.com/file/F17A92D0331607C7C59D0213ECE1C5F1C3770680/3379100.png';
        this.skillIcons['Lesser Jökulhlaup'] = 'https://render.guildwars2.com/file/3333FBE3CB1331A40AC51903580FCFB09BC80335/3379103.png';
        this.skillIcons['Lesser Derecho'] = 'https://render.guildwars2.com/file/93950D05BFE50508031DA59BA0381252F60FEDBC/3379094.png';
        this.skillIcons['Lesser Haboob'] = 'https://render.guildwars2.com/file/E5FDD5E622E3DF73496BB35C0E33B429B8C5EB52/3379097.png';
        this.skillIcons['Volcano'] = 'https://render.guildwars2.com/file/334EA928E56F38C176A22415DE3ECE144C5FD5BB/3379101.png';
        this.skillIcons['Jökulhlaup'] = 'https://render.guildwars2.com/file/48EB1A03297EE4DFA0FE2CA41F0B02B77302060B/3379104.png';
        this.skillIcons['Derecho'] = 'https://render.guildwars2.com/file/94F1A894667CA4F3407C57B055F8236804264B1F/3379095.png';
        this.skillIcons['Haboob'] = 'https://render.guildwars2.com/file/562F2D0ED67AD8453F9CA60F27DB154F2E7543FC/3379098.png';
        this.skillIcons['Aerial Agility (chain)'] = 'https://render.guildwars2.com/file/C42D0718C2AB217B05E8414D514EAEFCC7407EF1/3256332.png';
        this.skillIcons['Aerial Agility (dash)'] = 'https://render.guildwars2.com/file/B10398A8E33A70A9101F294993673004017916C1/3256333.png';
        this.skillIcons['Aerial Agility'] = 'https://render.guildwars2.com/file/ADD2E4D6D49F22AF2C033058A6FF02BD316BFBC9/3256331.png';
        this.skillIcons['Flame Burst'] = 'https://wiki.guildwars2.com/images/7/79/Flame_Burst.png';
        this.skillIcons['Flame Burst (trait)'] = 'https://wiki.guildwars2.com/images/7/79/Flame_Burst.png';
        this.skillIcons['Cleansing Wave'] = 'https://wiki.guildwars2.com/images/0/07/Cleansing_Wave.png';
        this.skillIcons['Cleansing Wave (trait)'] = 'https://wiki.guildwars2.com/images/0/07/Cleansing_Wave.png';
        this.skillIcons['Blinding Flash'] = 'https://wiki.guildwars2.com/images/8/89/Blinding_Flash.png';
        this.skillIcons['Blinding Flash (trait)'] = 'https://wiki.guildwars2.com/images/8/89/Blinding_Flash.png';
        this.skillIcons['Shock Wave'] = 'https://wiki.guildwars2.com/images/9/93/Shock_Wave.png';
        this.skillIcons['Shock Wave (trait)'] = 'https://wiki.guildwars2.com/images/9/93/Shock_Wave.png';
    }

    getSkillIcon(name) {
        if (this.skillIcons[name]) return this.skillIcons[name];
        const base = name.replace(/\s*\(.*\)$/, '');
        if (this.skillIcons[base]) return this.skillIcons[base];
        const quoted = `\u201C${name}\u201D`;
        if (this.skillIcons[quoted]) return this.skillIcons[quoted];
        const dquoted = `"${name}"`;
        if (this.skillIcons[dquoted]) return this.skillIcons[dquoted];
        if (this.skillIcons[name + '!']) return this.skillIcons[name + '!'];
        const baseQuoted = `\u201C${base}\u201D`;
        if (this.skillIcons[baseQuoted]) return this.skillIcons[baseQuoted];
        const baseDquoted = `"${base}"`;
        if (this.skillIcons[baseDquoted]) return this.skillIcons[baseDquoted];
        return null;
    }

    getTraitIcon(name) {
        // Flow State (reworked) reuses the Invigorating Strikes icon.
        if (name === 'Flow State' && !this.traitIcons[name]) {
            return this.traitIcons['Invigorating Strikes'] || null;
        }
        return this.traitIcons[name] || null;
    }

    getSpecData(name) {
        return this.specData[name] || null;
    }
}

export const PLACEHOLDER_ICON = 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="8" fill="#2a2a3a"/>
        <text x="32" y="36" text-anchor="middle" fill="#666" font-size="12">?</text>
    </svg>`
);
