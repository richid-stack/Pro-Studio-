import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SOUND_LIBRARY, STARTER_BEATS, availableTags, buildBrowserTree, countLeaves, createStarterProject, flattenLeaves, flattenVisible,
  isFiltering, isStarrable, toggleInSet, treeNav, typeahead, type BrowserQuery,
} from '../src/index';

const project = createStarterProject('trap');
const q = (over: Partial<BrowserQuery> = {}): BrowserQuery => ({ tab: 'all', text: '', tags: [], starred: new Set(), ...over });
const ids = (nodes: ReturnType<typeof buildBrowserTree>) => flattenLeaves(nodes).map((n) => n.id);

describe('what the tree holds', () => {
  it('All shows the project, the sounds and the starter beats', () => {
    const tree = buildBrowserTree(project.channels, q());
    assert.deepEqual(tree.map((n) => n.id), ['project', 'sounds', 'starters']);
    assert.equal(countLeaves(tree[0]!), project.channels.length);
    assert.equal(countLeaves(tree[1]!), SOUND_LIBRARY.length);
    assert.equal(countLeaves(tree[2]!), STARTER_BEATS.length);
  });
  it('the Project and Sounds tabs show only their own folder', () => {
    assert.deepEqual(buildBrowserTree(project.channels, q({ tab: 'project' })).map((n) => n.id), ['project']);
    assert.deepEqual(buildBrowserTree(project.channels, q({ tab: 'sounds' })).map((n) => n.id), ['sounds']);
  });
  it('sounds are split into drums and instruments', () => {
    const sounds = buildBrowserTree(project.channels, q({ tab: 'sounds' }))[0]!;
    assert.deepEqual(sounds.children!.map((n) => n.label), ['Drums', 'Instruments']);
  });
  it('a channel says how much is in it', () => {
    const rows = flattenLeaves(buildBrowserTree(project.channels, q({ tab: 'project' })));
    assert.ok(rows.every((r) => /^\d+ (hit|hits|note|notes)$/.test(r.hint ?? '')));
  });
  it('an empty project still shows its folder, with nothing inside the filter', () => {
    const tree = buildBrowserTree([], q({ tab: 'project' }));
    assert.equal(tree[0]!.children!.length, 0);
  });
});

describe('stars', () => {
  it('the Starred tab lists only what is starred, flat, in the tree order', () => {
    const tree = buildBrowserTree(project.channels, q({ tab: 'starred', starred: new Set(['inst:pad', 'drum:kick', 'starter:drill']) }));
    assert.equal(tree.length, 1);
    assert.deepEqual(ids(tree), ['drum:kick', 'inst:pad', 'starter:drill']);
  });
  it('is empty when nothing is starred', () => {
    assert.deepEqual(buildBrowserTree(project.channels, q({ tab: 'starred' })), []);
  });
  it('a channel of the project cannot be starred, a sound and a starter can', () => {
    const all = flattenLeaves(buildBrowserTree(project.channels, q()));
    assert.ok(all.filter((n) => n.leaf?.kind === 'channel').every((n) => !isStarrable(n)));
    assert.ok(all.filter((n) => n.leaf?.kind !== 'channel').every(isStarrable));
    const asked = buildBrowserTree(project.channels, q({ tab: 'starred', starred: new Set([`channel:${project.channels[0]!.id}`]) }));
    assert.deepEqual(asked, []);
  });
  it('toggleInSet adds, removes and does not change the input', () => {
    const a = new Set(['x']);
    assert.deepEqual([...toggleInSet(a, 'y')], ['x', 'y']);
    assert.deepEqual([...toggleInSet(a, 'x')], []);
    assert.deepEqual([...toggleInSet(a, 'x', true)], ['x']);
    assert.deepEqual([...a], ['x']);
  });
});

describe('search and tags', () => {
  it('search words must all match, and folders with no match disappear', () => {
    const tree = buildBrowserTree(project.channels, q({ tab: 'sounds', text: 'open shimmer' }));
    assert.deepEqual(ids(tree), ['drum:ohat']);
    assert.deepEqual(tree[0]!.children!.map((n) => n.id), ['sounds:drums']);
  });
  it('search reaches tags and the starter beats', () => {
    assert.ok(ids(buildBrowserTree(project.channels, q({ text: 'bass' }))).includes('inst:sub'));
    assert.deepEqual(ids(buildBrowserTree(project.channels, q({ text: 'syncopated' }))), ['starter:afro']);
  });
  it('tags narrow to items that carry all of them', () => {
    assert.deepEqual(ids(buildBrowserTree(project.channels, q({ tab: 'sounds', tags: ['hats'] }))).sort(), ['drum:hat', 'drum:ohat']);
    assert.deepEqual(ids(buildBrowserTree(project.channels, q({ tab: 'sounds', tags: ['drums', 'low'] }))), ['drum:kick']);
    assert.deepEqual(ids(buildBrowserTree(project.channels, q({ tab: 'sounds', tags: ['hats', 'bass'] }))), []);
  });
  it('tags also apply to the channels of the project', () => {
    const hats = ids(buildBrowserTree(project.channels, q({ tab: 'project', tags: ['hats'] })));
    assert.ok(hats.length > 0 && hats.every((id) => id.startsWith('channel:')));
  });
  it('knows when it is filtering', () => {
    assert.equal(isFiltering({ text: '  ', tags: [] }), false);
    assert.equal(isFiltering({ text: 'a', tags: [] }), true);
    assert.equal(isFiltering({ text: '', tags: ['low'] }), true);
  });
  it('offers only tags that something on screen carries, in a fixed order', () => {
    const tree = buildBrowserTree(project.channels, q({ tab: 'sounds', text: 'kick' }));
    assert.deepEqual(availableTags(tree), ['drums', 'low']);
    assert.deepEqual(availableTags([]), []);
  });
});

describe('rows on screen', () => {
  const tree = buildBrowserTree(project.channels, q());
  it('closed folders hide their children; open ones show them with depth and set position', () => {
    const closed = flattenVisible(tree, new Set());
    assert.deepEqual(closed.map((r) => r.node.id), ['project', 'sounds', 'starters']);
    assert.ok(closed.every((r) => r.expandable && !r.open && r.depth === 0));
    const open = flattenVisible(tree, new Set(['sounds', 'sounds:drums']));
    const kick = open.find((r) => r.node.id === 'drum:kick')!;
    assert.equal(kick.depth, 2);
    assert.equal(kick.parentId, 'sounds:drums');
    assert.equal(kick.posInSet, 1);
    assert.equal(kick.setSize, 6);
    assert.equal(open.find((r) => r.node.id === 'sounds:instruments')!.posInSet, 2);
  });
  it('opens every folder while filtering', () => {
    const rows = flattenVisible(buildBrowserTree(project.channels, q({ text: 'pad' })), new Set(), true);
    assert.ok(rows.some((r) => r.node.id === 'inst:pad'));
  });
});

describe('tree keys', () => {
  const tree = buildBrowserTree(project.channels, q({ tab: 'sounds' }));
  const rows = flattenVisible(tree, new Set(['sounds', 'sounds:drums']));
  const id = (i: number) => rows[i]!.node.id;

  it('Down and Up walk the rows and stop at the ends', () => {
    assert.equal(treeNav(rows, id(0), 'ArrowDown').active, id(1));
    assert.equal(treeNav(rows, id(1), 'ArrowUp').active, id(0));
    assert.equal(treeNav(rows, id(0), 'ArrowUp').active, id(0));
    assert.equal(treeNav(rows, id(rows.length - 1), 'ArrowDown').active, id(rows.length - 1));
  });
  it('Home and End jump', () => {
    assert.equal(treeNav(rows, id(3), 'Home').active, id(0));
    assert.equal(treeNav(rows, id(0), 'End').active, id(rows.length - 1));
  });
  it('Right opens a closed folder, then steps into it', () => {
    const instruments = rows.find((r) => r.node.id === 'sounds:instruments')!;
    assert.deepEqual(treeNav(rows, instruments.node.id, 'ArrowRight'), { active: 'sounds:instruments', open: { id: 'sounds:instruments', open: true } });
    assert.equal(treeNav(rows, 'sounds:drums', 'ArrowRight').active, 'drum:kick');
  });
  it('Right on an item does nothing', () => {
    assert.deepEqual(treeNav(rows, 'drum:kick', 'ArrowRight'), { active: 'drum:kick' });
  });
  it('Left closes an open folder, then steps out to the parent', () => {
    assert.deepEqual(treeNav(rows, 'sounds:drums', 'ArrowLeft'), { active: 'sounds:drums', open: { id: 'sounds:drums', open: false } });
    assert.equal(treeNav(rows, 'drum:kick', 'ArrowLeft').active, 'sounds:drums');
    assert.equal(treeNav(rows, 'sounds', 'ArrowLeft').open?.open, false);
  });
  it('starts at the top, or at the bottom for End, when nothing is active yet', () => {
    assert.equal(treeNav(rows, null, 'ArrowDown').active, id(0));
    assert.equal(treeNav(rows, 'gone', 'End').active, id(rows.length - 1));
    assert.equal(treeNav([], null, 'ArrowDown').active, null);
  });
  it('typing a letter jumps to the next name that starts with it, and cycles', () => {
    assert.equal(typeahead(rows, 'sounds', 'k'), 'drum:kick');
    assert.equal(typeahead(rows, 'drum:kick', 's'), 'drum:snare');
    assert.equal(typeahead(rows, 'drum:snare', 's'), 'sounds');
    assert.equal(typeahead(rows, 'sounds', 'q'), null);
    assert.equal(typeahead(rows, null, ''), null);
  });
});
