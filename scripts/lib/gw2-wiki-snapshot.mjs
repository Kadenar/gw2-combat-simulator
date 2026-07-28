export const GW2_WIKI_API = "https://wiki.guildwars2.com/api.php";
export const GW2_WIKI_USER_AGENT =
  "gw2-combat-simulator/2.0 (profession mechanics research)";

function apiUrl(parameters, apiRoot = GW2_WIKI_API) {
  const url = new URL(apiRoot);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }
  return url;
}

export async function fetchWikiApi(parameters, {
  fetchImpl = fetch,
  apiRoot = GW2_WIKI_API,
} = {}) {
  const response = await fetchImpl(apiUrl(parameters, apiRoot), {
    headers: { "User-Agent": GW2_WIKI_USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(
      `Guild Wars 2 Wiki request failed (${response.status}).`,
    );
  }
  return response.json();
}

export async function fetchWikiCategoryTitles(category, options = {}) {
  const titles = [];
  let cmcontinue = "";
  do {
    const response = await fetchWikiApi({
      action: "query",
      list: "categorymembers",
      cmtitle: `Category:${category}`,
      cmnamespace: "0",
      cmlimit: "max",
      format: "json",
      formatversion: "2",
      ...(cmcontinue ? { cmcontinue } : {}),
    }, options);
    titles.push(
      ...(response.query?.categorymembers || []).map(page => page.title),
    );
    cmcontinue = response.continue?.cmcontinue || "";
  } while (cmcontinue);
  return titles;
}

export async function fetchWikiPages(titles, options = {}) {
  const pages = [];
  const uniqueTitles = [...new Set(titles)].sort();
  for (let index = 0; index < uniqueTitles.length; index += 50) {
    const response = await fetchWikiApi({
      action: "query",
      prop: "revisions",
      rvprop: "ids|timestamp|content",
      rvslots: "main",
      titles: uniqueTitles.slice(index, index + 50).join("|"),
      format: "json",
      formatversion: "2",
    }, options);
    pages.push(...(response.query?.pages || []));
  }
  return pages;
}

function matchingTemplateEnd(source, start) {
  let depth = 0;
  for (let index = start; index < source.length - 1; index += 1) {
    const pair = source.slice(index, index + 2);
    if (pair === "{{") {
      depth += 1;
      index += 1;
    } else if (pair === "}}") {
      depth -= 1;
      index += 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
}

export function extractTemplate(source, templateName) {
  const pattern = new RegExp(
    `\\{\\{\\s*${String(templateName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i",
  );
  const match = pattern.exec(source);
  if (!match) return "";
  const end = matchingTemplateEnd(source, match.index);
  return end < 0 ? "" : source.slice(match.index, end);
}

function splitTemplateParts(template) {
  const content = template.slice(2, -2);
  const parts = [];
  let current = "";
  let templateDepth = 0;
  let linkDepth = 0;
  for (let index = 0; index < content.length; index += 1) {
    const pair = content.slice(index, index + 2);
    if (pair === "{{") {
      templateDepth += 1;
      current += pair;
      index += 1;
    } else if (pair === "}}" && templateDepth > 0) {
      templateDepth -= 1;
      current += pair;
      index += 1;
    } else if (pair === "[[") {
      linkDepth += 1;
      current += pair;
      index += 1;
    } else if (pair === "]]" && linkDepth > 0) {
      linkDepth -= 1;
      current += pair;
      index += 1;
    } else if (
      content[index] === "|"
      && templateDepth === 0
      && linkDepth === 0
    ) {
      parts.push(current);
      current = "";
    } else {
      current += content[index];
    }
  }
  parts.push(current);
  return parts;
}

export function parseWikiTemplate(template) {
  const [name = "", ...parts] = splitTemplateParts(template);
  const positional = [];
  const named = {};
  for (const rawPart of parts) {
    const equals = rawPart.indexOf("=");
    if (equals < 0) {
      positional.push(rawPart.trim());
      continue;
    }
    const key = rawPart.slice(0, equals).trim().toLowerCase();
    named[key] = rawPart.slice(equals + 1).trim();
  }
  return {
    name: name.trim(),
    positional,
    named,
  };
}

export function nestedTemplates(source, templateName) {
  const values = [];
  const normalizedName = String(templateName).toLowerCase();
  for (let index = 0; index < source.length - 1; index += 1) {
    if (source.slice(index, index + 2) !== "{{") continue;
    const end = matchingTemplateEnd(source, index);
    if (end < 0) break;
    const template = source.slice(index, end);
    const parsed = parseWikiTemplate(template);
    if (parsed.name.toLowerCase() === normalizedName) values.push(parsed);
    index = end - 1;
  }
  return values;
}

function plainWikiText(value) {
  return String(value || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function numericIds(value) {
  const source = String(value || "").replace(/<!--[\s\S]*?-->/g, "");
  return [...source.matchAll(/\d+/g)]
    .map(match => Number(match[0]))
    .filter(Number.isFinite);
}

function pveFact(fact) {
  const modes = String(fact.named["game mode"] || "")
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);
  return modes.length === 0 || modes.includes("pve");
}

function skillFactSnapshot(fact) {
  const [kind = "", ...values] = fact.positional;
  return {
    kind: plainWikiText(kind),
    values: values.map(plainWikiText),
    label: plainWikiText(fact.named.alt),
    coefficient: fact.named.coefficient == null
      ? null
      : Number(fact.named.coefficient),
    strikes: fact.named.strikes == null
      ? null
      : Number(fact.named.strikes),
    stacks: fact.named.stacks == null
      ? null
      : Number(fact.named.stacks),
    interval: fact.named.interval == null
      ? null
      : Number(fact.named.interval),
    weapon: plainWikiText(fact.named.weapon),
    gameModes: String(fact.named["game mode"] || "")
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean),
  };
}

export function wikiSkillSnapshot(page, professionName) {
  const revision = page.revisions?.[0];
  const source = revision?.slots?.main?.content || "";
  const infoboxSource = extractTemplate(source, "Skill infobox");
  if (!infoboxSource) return null;
  const infobox = parseWikiTemplate(infoboxSource);
  if (
    String(infobox.named.profession || "").trim().toLowerCase()
    !== professionName.toLowerCase()
  ) return null;
  const ids = numericIds(infobox.named.id);
  if (!ids.length) return null;
  return {
    page: page.title,
    sourceUrl:
      `https://wiki.guildwars2.com/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    revisionId: Number(revision.revid),
    revisionTimestamp: revision.timestamp,
    ids,
    description: plainWikiText(infobox.named.description),
    specialization: plainWikiText(infobox.named.specialization),
    slot: plainWikiText(infobox.named.slot),
    type: plainWikiText(infobox.named.type),
    kit: plainWikiText(infobox.named.kit),
    parent: plainWikiText(infobox.named.parent),
    weaponSlot: Number(infobox.named["weapon slot"]) || null,
    mechanicSlot: Number(infobox.named["mechanic slot"]) || null,
    mainhand: plainWikiText(infobox.named.mainhand),
    offhand: plainWikiText(infobox.named.offhand),
    weapon: plainWikiText(infobox.named.weapon),
    activation: plainWikiText(infobox.named.activation),
    recharge: plainWikiText(infobox.named.recharge),
    ammo: plainWikiText(infobox.named.ammo),
    energy: plainWikiText(infobox.named.energy),
    upkeep: plainWikiText(infobox.named.upkeep),
    initiative: plainWikiText(infobox.named.initiative),
    underwaterReplacement: plainWikiText(infobox.named["uw replaced by"]),
    facts: nestedTemplates(infobox.named.facts || "", "skill fact")
      .filter(pveFact)
      .map(skillFactSnapshot),
  };
}

export async function fetchProfessionWikiSkillSnapshot({
  professionName,
  categories,
  options = {},
}) {
  const categoryTitles = await Promise.all(
    categories.map(category => fetchWikiCategoryTitles(category, options)),
  );
  const pages = await fetchWikiPages(categoryTitles.flat(), options);
  return pages
    .map(page => wikiSkillSnapshot(page, professionName))
    .filter(Boolean)
    .sort((left, right) =>
      left.ids[0] - right.ids[0] || left.page.localeCompare(right.page));
}

export function serializeWikiSkillSnapshot({
  professionName,
  snapshotDate,
  categories,
  skills,
}) {
  const id = professionName.toLowerCase();
  return [
    `// Generated ${professionName} PvE mechanics research from the Guild Wars 2 Wiki.`,
    `// Snapshot: ${snapshotDate}. Runtime tests never fetch the network.`,
    `// Categories: ${categories.join(", ")}.`,
    "",
    `export const WIKI_DATA_SNAPSHOT = ${JSON.stringify(snapshotDate)};`,
    `export const WIKI_SKILL_RESEARCH = ${JSON.stringify(skills, null, 2)};`,
    "",
    `export const WIKI_SKILL_RESEARCH_BY_ID = new Map(`,
    `  WIKI_SKILL_RESEARCH.flatMap(skill =>`,
    `    skill.ids.map(id => [id, skill])),`,
    `);`,
    "",
  ].join("\n");
}
