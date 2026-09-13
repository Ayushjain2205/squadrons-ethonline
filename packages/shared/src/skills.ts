/**
 * Desk slash-skill catalog.
 * Keep in sync with `.agents/skills/<name>/SKILL.md` (name + description).
 * dsh discovers the files; this list only drives the composer picker.
 */
export type DeskSkill = {
  /** kebab-case — must match SKILL.md `name` and the `/name` token. */
  name: string;
  /** Short picker label. */
  label: string;
  /** One-line subtitle in the slash menu. */
  blurb: string;
};

export const DESK_SKILLS: readonly DeskSkill[] = [
  {
    name: "market-analyser",
    label: "Market analyser",
    blurb: "Trending pools, flow, and a short operator brief.",
  },
  {
    name: "wallet-pulse",
    label: "Wallet pulse",
    blurb: "Balances, gas headroom, and desk readiness.",
  },
  {
    name: "event-pipeline",
    label: "Event pipeline",
    blurb: "Author a Substreams listener, then draft the strategy.",
  },
] as const;

export function deskSkillByName(name: string): DeskSkill | undefined {
  const key = name.trim().toLowerCase();
  return DESK_SKILLS.find((skill) => skill.name === key);
}

/**
 * Match an in-progress `/token` at the cursor (start of text or after whitespace).
 * Closes once the user types a space after the name.
 */
export function matchSlashSkillQuery(
  text: string,
  cursor = text.length,
): { start: number; end: number; query: string } | null {
  const before = text.slice(0, cursor);
  const match = before.match(/(^|\s)\/([a-z0-9-]*)$/i);
  if (!match || match.index === undefined) return null;
  const slashAt = match.index + match[1]!.length;
  return {
    start: slashAt,
    end: cursor,
    query: match[2]!.toLowerCase(),
  };
}

export function filterDeskSkills(query: string): DeskSkill[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...DESK_SKILLS];
  return DESK_SKILLS.filter(
    (skill) =>
      skill.name.includes(q) ||
      skill.label.toLowerCase().includes(q) ||
      skill.blurb.toLowerCase().includes(q),
  );
}

export type DeskSkillTextSegment =
  | { kind: "text"; value: string }
  | { kind: "skill"; value: string; name: string }
  | { kind: "plugin"; value: string; name: string };

const DESK_SKILL_NAME_SET = new Set(
  DESK_SKILLS.map((skill) => skill.name.toLowerCase()),
);

/**
 * Split text into plain, `/skill`, and `@plugin` runs (whitespace-bounded).
 * Plugin names are the MCP `serverName` values (case-insensitive).
 */
export function splitComposerTokens(
  text: string,
  pluginServerNames: Iterable<string> = [],
): DeskSkillTextSegment[] {
  if (!text) return [{ kind: "text", value: "" }];
  const pluginSet = new Set(
    [...pluginServerNames].map((name) => name.toLowerCase()),
  );
  const segments: DeskSkillTextSegment[] = [];
  const re = /(^|[\s])([/@])([A-Za-z0-9_-]+)\b/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const lead = match[1] ?? "";
    const sigil = match[2] ?? "";
    const name = (match[3] ?? "").toLowerCase();
    const token = `${sigil}${match[3] ?? ""}`;
    const tokenStart = match.index + lead.length;
    let kind: "skill" | "plugin" | null = null;
    if (sigil === "/" && DESK_SKILL_NAME_SET.has(name)) kind = "skill";
    if (sigil === "@" && pluginSet.has(name)) kind = "plugin";
    if (!kind) continue;
    if (tokenStart > last) {
      segments.push({ kind: "text", value: text.slice(last, tokenStart) });
    }
    segments.push({ kind, value: token, name });
    last = tokenStart + token.length;
  }
  if (last < text.length) {
    segments.push({ kind: "text", value: text.slice(last) });
  }
  if (segments.length === 0) {
    return [{ kind: "text", value: text }];
  }
  return segments;
}

/** @deprecated Prefer {@link splitComposerTokens}. */
export function splitDeskSkillTokens(text: string): DeskSkillTextSegment[] {
  return splitComposerTokens(text);
}
