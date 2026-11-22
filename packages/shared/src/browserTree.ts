/**
 * The browser panel as data: a tree of folders and items, filtered by tab, search words, tags and stars, and
 * flattened into the rows that are on screen so keyboard movement can be tested without a DOM.
 *
 * Only things that really exist are in the tree: the channels in the project, the sounds the engine can make,
 * and the starter beats. Packs, recordings and your own files arrive with file loading (docs/ROADMAP.md).
 */
import type { Channel, InstrumentName } from './project';
import { SOUND_LIBRARY, matchesQuery, soundSearchText, type SoundEntry } from './sounds';
import { createStarterProject } from './starter';
import type { Genre } from './theory';

export type BrowserTab = 'all' | 'project' | 'sounds' | 'starred';

export const BROWSER_TABS: ReadonlyArray<{ id: BrowserTab; label: string; hint: string }> = [
  { id: 'all', label: 'All', hint: 'Everything: your project, the sounds and the starter beats' },
  { id: 'project', label: 'Project', hint: 'The channels in this project' },
  { id: 'sounds', label: 'Sounds', hint: 'Drums and instruments you can add' },
  { id: 'starred', label: 'Starred', hint: 'Sounds and beats you starred' },
];

export function isBrowserTab(value: unknown): value is BrowserTab {
  return BROWSER_TABS.some((t) => t.id === value);
}

export type BrowserIconName = 'folder' | 'project' | 'drum' | 'wave' | 'keys' | 'note' | 'beat';

const STARTER_DEFS: ReadonlyArray<{ genre: Genre; label: string; feel: string }> = [
  { genre: 'trap', label: 'Trap', feel: 'Hard 808s with rolling hats' },
  { genre: 'drill', label: 'Drill', feel: 'Sliding 808s and off-beat snares' },
  { genre: 'rnb', label: 'R&B', feel: 'Slow, swung and warm' },
  { genre: 'afro', label: 'Afrobeat', feel: 'Bouncy and syncopated' },
];

export const STARTER_BEATS: ReadonlyArray<{ genre: Genre; label: string; feel: string; bpm: number }> = STARTER_DEFS.map((s) => ({
  ...s,
  bpm: createStarterProject(s.genre).bpm,
}));

/** What an item does when it is chosen. */
export type BrowserLeaf =
  | { kind: 'sound'; sound: SoundEntry }
  | { kind: 'starter'; genre: Genre }
  | { kind: 'channel'; channelId: string };

export interface BrowserNode {
  id: string;
  label: string;
  /** One quiet line after the name. */
  hint?: string;
  icon: BrowserIconName;
  tags?: readonly string[];
  /** Present on items; absent on folders. */
  leaf?: BrowserLeaf;
  children?: BrowserNode[];
}

export interface BrowserQuery {
  tab: BrowserTab;
  text: string;
  /** Every listed tag must be on an item for it to show. */
  tags: readonly string[];
  starred: ReadonlySet<string>;
}

/** The tags offered as filter chips, in this order, when at least one visible item carries them. */
export const TAG_FILTERS: readonly string[] = ['drums', 'hats', 'bass', 'keys', 'chords', 'low', 'bright', 'warm'];

const SOUND_ICON: Readonly<Record<string, BrowserIconName>> = { sub: 'wave', rhodes: 'keys', organ: 'keys', pluck: 'note', pad: 'note' };

const soundNode = (s: SoundEntry): BrowserNode => ({
  id: s.id,
  label: s.label,
  hint: s.hint,
  icon: s.kind === 'drum' ? 'drum' : (SOUND_ICON[s.inst] ?? 'note'),
  tags: s.tags,
  leaf: { kind: 'sound', sound: s },
});

function tagsForChannel(c: Channel): readonly string[] {
  if (c.type === 'drum') return SOUND_LIBRARY.find((s) => s.kind === 'drum' && s.drum === c.drum)?.tags ?? ['drums'];
  const inst: InstrumentName = c.type === 'inst' ? c.inst : 'sampler';
  return SOUND_LIBRARY.find((s) => s.kind === 'inst' && s.inst === inst)?.tags ?? ['instrument'];
}

function channelNode(c: Channel): BrowserNode {
  const drum = c.type === 'drum';
  const hits = drum ? c.v.filter((v) => v > 0).length : 0;
  const notes = c.type === 'inst' ? c.notes.length : 0;
  return {
    id: `channel:${c.id}`,
    label: c.name,
    hint: drum ? `${hits} ${hits === 1 ? 'hit' : 'hits'}` : c.type === 'inst' ? `${notes} ${notes === 1 ? 'note' : 'notes'}` : 'Sample channel',
    icon: drum ? 'drum' : c.type === 'inst' ? (SOUND_ICON[c.inst] ?? 'note') : 'wave',
    tags: tagsForChannel(c),
    leaf: { kind: 'channel', channelId: c.id },
  };
}

const starterNode = (s: (typeof STARTER_BEATS)[number]): BrowserNode => ({
  id: `starter:${s.genre}`,
  label: s.label,
  hint: `${s.feel}, ${s.bpm} BPM`,
  icon: 'beat',
  tags: ['beat', s.genre],
  leaf: { kind: 'starter', genre: s.genre },
});

function fullTree(channels: readonly Channel[], tab: BrowserTab): BrowserNode[] {
  const project: BrowserNode = { id: 'project', label: 'Current project', icon: 'project', children: channels.map(channelNode) };
  const sounds: BrowserNode = {
    id: 'sounds',
    label: 'Sounds',
    icon: 'folder',
    children: [
      { id: 'sounds:drums', label: 'Drums', icon: 'folder', children: SOUND_LIBRARY.filter((s) => s.kind === 'drum').map(soundNode) },
      { id: 'sounds:instruments', label: 'Instruments', icon: 'folder', children: SOUND_LIBRARY.filter((s) => s.kind === 'inst').map(soundNode) },
    ],
  };
  const starters: BrowserNode = { id: 'starters', label: 'Starter beats', icon: 'folder', children: STARTER_BEATS.map(starterNode) };
  if (tab === 'project') return [project];
  if (tab === 'sounds') return [sounds];
  return [project, sounds, starters];
}

/** Whether an item can be starred: sounds and starter beats can, a channel of this project cannot. */
export function isStarrable(node: BrowserNode): boolean {
  return node.leaf?.kind === 'sound' || node.leaf?.kind === 'starter';
}

function leafText(n: BrowserNode): string {
  return n.leaf?.kind === 'sound' ? soundSearchText(n.leaf.sound) : `${n.label} ${n.hint ?? ''} ${(n.tags ?? []).join(' ')}`;
}

/** Keep the items that pass the filter, and the folders that still hold one. */
function prune(nodes: readonly BrowserNode[], keep: (leaf: BrowserNode) => boolean): BrowserNode[] {
  const out: BrowserNode[] = [];
  for (const n of nodes) {
    if (n.children) {
      const kids = prune(n.children, keep);
      if (kids.length > 0) out.push({ ...n, children: kids });
    } else if (keep(n)) {
      out.push(n);
    }
  }
  return out;
}

export function isFiltering(q: Pick<BrowserQuery, 'text' | 'tags'>): boolean {
  return q.text.trim() !== '' || q.tags.length > 0;
}

export function buildBrowserTree(channels: readonly Channel[], q: BrowserQuery): BrowserNode[] {
  let tree = fullTree(channels, q.tab);
  if (q.tab === 'starred') {
    const starred = prune(tree, (n) => isStarrable(n) && q.starred.has(n.id));
    const leaves = flattenLeaves(starred);
    tree = leaves.length > 0 ? [{ id: 'starred', label: 'Starred', icon: 'folder', children: leaves }] : [];
  }
  if (!isFiltering(q)) return tree;
  return prune(tree, (n) => matchesQuery(leafText(n), q.text) && q.tags.every((t) => (n.tags ?? []).includes(t)));
}

export function flattenLeaves(nodes: readonly BrowserNode[]): BrowserNode[] {
  return nodes.flatMap((n) => (n.children ? flattenLeaves(n.children) : [n]));
}

export function countLeaves(node: BrowserNode): number {
  return node.children ? node.children.reduce((sum, c) => sum + countLeaves(c), 0) : 1;
}

/** The filter chips worth showing for what is on screen: curated tags that at least one item carries. */
export function availableTags(nodes: readonly BrowserNode[]): string[] {
  const present = new Set(flattenLeaves(nodes).flatMap((n) => n.tags ?? []));
  return TAG_FILTERS.filter((t) => present.has(t));
}

export const DEFAULT_EXPANDED: readonly string[] = ['project', 'sounds', 'sounds:drums', 'sounds:instruments', 'starred'];

/* ---------------------------------------------------------------- rows on screen */

export interface BrowserRow {
  node: BrowserNode;
  /** 0 for a top-level folder. */
  depth: number;
  parentId: string | null;
  /** 1-based position among its siblings, for aria-posinset. */
  posInSet: number;
  setSize: number;
  expandable: boolean;
  open: boolean;
}

/** The rows a person sees: a folder's children are shown when it is open (all folders open while filtering). */
export function flattenVisible(nodes: readonly BrowserNode[], expanded: ReadonlySet<string>, openAll = false): BrowserRow[] {
  const rows: BrowserRow[] = [];
  const walk = (list: readonly BrowserNode[], depth: number, parentId: string | null): void => {
    list.forEach((node, i) => {
      const expandable = node.children !== undefined;
      const open = expandable && (openAll || expanded.has(node.id));
      rows.push({ node, depth, parentId, posInSet: i + 1, setSize: list.length, expandable, open });
      if (open && node.children) walk(node.children, depth + 1, node.id);
    });
  };
  walk(nodes, 0, null);
  return rows;
}

export type TreeKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

export interface TreeMove {
  /** The row that should be active after the key. */
  active: string | null;
  /** Open or close a folder, when the key asks for it. */
  open?: { id: string; open: boolean };
}

/** The WAI-ARIA tree keys: Up and Down walk the rows, Right opens or steps in, Left closes or steps out. */
export function treeNav(rows: readonly BrowserRow[], activeId: string | null, key: TreeKey): TreeMove {
  if (rows.length === 0) return { active: null };
  const at = rows.findIndex((r) => r.node.id === activeId);
  if (at < 0) return { active: rows[key === 'End' ? rows.length - 1 : 0]!.node.id };
  const row = rows[at]!;
  switch (key) {
    case 'ArrowDown':
      return { active: rows[Math.min(rows.length - 1, at + 1)]!.node.id };
    case 'ArrowUp':
      return { active: rows[Math.max(0, at - 1)]!.node.id };
    case 'Home':
      return { active: rows[0]!.node.id };
    case 'End':
      return { active: rows[rows.length - 1]!.node.id };
    case 'ArrowRight':
      if (row.expandable && !row.open) return { active: row.node.id, open: { id: row.node.id, open: true } };
      if (row.expandable && row.open && rows[at + 1]?.parentId === row.node.id) return { active: rows[at + 1]!.node.id };
      return { active: row.node.id };
    case 'ArrowLeft':
      if (row.expandable && row.open) return { active: row.node.id, open: { id: row.node.id, open: false } };
      return { active: row.parentId ?? row.node.id };
  }
}

/** Type a letter to jump to the next row whose name starts with it; repeating the letter cycles through them. */
export function typeahead(rows: readonly BrowserRow[], activeId: string | null, typed: string): string | null {
  const t = typed.toLowerCase();
  if (t === '' || rows.length === 0) return null;
  const at = rows.findIndex((r) => r.node.id === activeId);
  for (let step = 1; step <= rows.length; step++) {
    const row = rows[(Math.max(at, -1) + step + rows.length) % rows.length]!;
    if (row.node.label.toLowerCase().startsWith(t)) return row.node.id;
  }
  return null;
}

export function toggleInSet<T>(set: ReadonlySet<T>, item: T, on?: boolean): Set<T> {
  const next = new Set(set);
  const want = on ?? !next.has(item);
  if (want) next.add(item);
  else next.delete(item);
  return next;
}
