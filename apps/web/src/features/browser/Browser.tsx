import { createPortal } from 'react-dom';
import { useEffect, useId, useMemo, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { BROWSER_TABS, availableTags, buildBrowserTree, countLeaves, flattenVisible, isBrowserTab, isFeatureVisible, isFiltering, isStarrable, treeNav, typeahead, type BrowserRow, type BrowserTab, type TreeKey } from '@pro-studio/shared';
import { audition } from '../../audio/audition';
import { Icon, type IconName } from '../../components/Icon';
import { ToolButton, ToolGroup, Toolbar } from '../../components/Toolbar';
import { browserState, useBrowser } from '../../state/browser';
import { useStore } from '../../state/store';
import { studio } from '../../state/studio';
import { uiState, useUi } from '../../state/ui';
import { usePreferences } from '../../state/usePreferences';
import { SOUND_DRAG_TYPE, addSound, openStarter } from './actions';

const TREE_KEYS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];

function iconFor(row: BrowserRow): IconName {
  if (row.expandable) return row.node.icon === 'project' ? 'project' : row.open ? 'folder-open' : 'folder';
  return row.node.icon === 'folder' ? 'folder' : row.node.icon;
}

/**
 * The browser: a tree of the project's channels, the sound library and the starter beats. Click previews a
 * sound, double-click (or Enter) adds it, and a sound can be dragged onto the channel rack.
 */
export function Browser({ toolsHost }: { toolsHost: HTMLElement | null }) {
  const channels = useStore(studio.store, (h) => h.present.channels);
  const tab = useBrowser((s) => s.tab);
  const text = useBrowser((s) => s.text);
  const tags = useBrowser((s) => s.tags);
  const starredList = useBrowser((s) => s.starred);
  const expandedList = useBrowser((s) => s.expanded);
  const autoPreview = useBrowser((s) => s.autoPreview);
  const activeId = useBrowser((s) => s.active);
  const selectedChannel = useUi((s) => s.selectedChannelId);
  const { mode } = usePreferences();
  const showTags = isFeatureVisible('browser-tags', mode);
  const showHelp = isFeatureVisible('plain-language', mode);
  const base = useId();
  const treeRef = useRef<HTMLDivElement>(null);
  const focusNext = useRef(false);

  const starred = useMemo(() => new Set(starredList), [starredList]);
  const expanded = useMemo(() => new Set(expandedList), [expandedList]);
  const tree = useMemo(() => buildBrowserTree(channels, { tab, text, tags, starred }), [channels, tab, text, tags, starred]);
  const filtering = isFiltering({ text, tags });
  const rows = useMemo(() => flattenVisible(tree, expanded, filtering), [tree, expanded, filtering]);
  const tagChoices = useMemo(() => {
    const offered = availableTags(buildBrowserTree(channels, { tab, text, tags: [], starred }));
    return [...offered, ...tags.filter((t) => !offered.includes(t))];
  }, [channels, tab, text, tags, starred]);

  const current = rows.some((r) => r.node.id === activeId) ? activeId : (rows[0]?.node.id ?? null);

  // after a keyboard move, put focus on the new row once it is in the DOM
  useEffect(() => {
    if (!focusNext.current || !current) return;
    focusNext.current = false;
    treeRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(current)}"]`)?.focus();
  }, [current, rows]);

  const preview = (row: BrowserRow): void => {
    if (row.node.leaf?.kind === 'sound') audition(row.node.leaf.sound);
  };

  const activate = (row: BrowserRow): void => {
    const leaf = row.node.leaf;
    if (!leaf) {
      browserState.setOpen(row.node.id, !row.open);
    } else if (leaf.kind === 'sound') {
      addSound(leaf.sound);
    } else if (leaf.kind === 'starter') {
      openStarter(leaf.genre, row.node.label);
    } else {
      uiState.selectChannel(leaf.channelId);
      uiState.announce(`Selected ${row.node.label}. Its pattern is in the channel rack${row.node.icon === 'drum' ? '' : ' and the piano roll'}.`);
    }
  };

  const star = (row: BrowserRow): void => {
    if (!isStarrable(row.node)) return;
    const on = browserState.toggleStar(row.node.id);
    uiState.announce(`${on ? 'Starred' : 'Removed the star from'} ${row.node.label}.`);
  };

  const click = (row: BrowserRow): void => {
    browserState.set({ active: row.node.id });
    if (!row.node.leaf) browserState.setOpen(row.node.id, !row.open);
    else if (autoPreview) preview(row);
    if (row.node.leaf?.kind === 'channel') uiState.selectChannel(row.node.leaf.channelId);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    const row = rows.find((r) => r.node.id === current);
    if (!row || e.ctrlKey || e.metaKey) return;
    if (TREE_KEYS.includes(e.key)) {
      e.preventDefault();
      const move = treeNav(rows, current, e.key as TreeKey);
      if (move.open) browserState.setOpen(move.open.id, move.open.open);
      if (move.active && move.active !== current) {
        focusNext.current = true;
        browserState.set({ active: move.active });
        const target = rows.find((r) => r.node.id === move.active);
        if (target && autoPreview) preview(target);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(row);
    } else if (e.key === ' ') {
      e.preventDefault();
      if (row.node.leaf) preview(row);
      else browserState.setOpen(row.node.id, !row.open);
    } else if (e.altKey && e.code === 'KeyS') {
      e.preventDefault();
      star(row);
    } else if (e.key.length === 1 && !e.altKey) {
      // a letter jumps to the next name that starts with it; it never reaches the typing piano
      e.preventDefault();
      const hit = typeahead(rows, current, e.key);
      if (hit) {
        focusNext.current = true;
        browserState.set({ active: hit });
      }
    }
  };

  const setTab = (next: BrowserTab, focus = false): void => {
    browserState.set({ tab: next });
    if (focus) document.getElementById(`${base}-${next}`)?.focus();
  };

  const emptyMessage =
    tab === 'starred' && !filtering
      ? 'Nothing starred yet. Star a sound or a starter beat and it will be here.'
      : filtering
        ? `Nothing matches${text.trim() ? ` “${text.trim()}”` : ' those tags'}. Try “kick” or “bass”, or clear the filters.`
        : tab === 'project'
          ? 'This project has no channels yet. Add a sound from the Sounds tab.'
          : 'Nothing to show.';

  const toolbar = (
    <Toolbar label="Browser tools" className="browser-toolbar">
      <ToolGroup label="Browser">
        <ToolButton icon="speaker" label="Preview sounds when selected" hint="Preview a sound when you click it or move to it with the arrow keys" hue="snap" pressed={autoPreview} onClick={() => browserState.set({ autoPreview: !autoPreview })} />
        <ToolButton icon="collapse" label="Collapse all folders" onClick={() => browserState.collapseAll()} />
      </ToolGroup>
    </Toolbar>
  );

  return (
    <div className="browser">
      <div className="tabs" role="tablist" aria-label="Browser sections">
        {BROWSER_TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${base}-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`${base}-panel`}
            tabIndex={tab === t.id ? 0 : -1}
            className="tab"
            title={t.hint}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (step === 0 && e.key !== 'Home' && e.key !== 'End') return;
              e.preventDefault();
              const index = e.key === 'Home' ? 0 : e.key === 'End' ? BROWSER_TABS.length - 1 : (i + step + BROWSER_TABS.length) % BROWSER_TABS.length;
              const next = BROWSER_TABS[index]?.id;
              if (next && isBrowserTab(next)) setTab(next, true);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {toolsHost && createPortal(toolbar, toolsHost)}
      <div className="browser-tools">
        <div className="search">
          <Icon name="search" size="sm" />
          <input
            type="search"
            aria-label="Search the browser"
            placeholder="Search"
            value={text}
            onChange={(e) => browserState.set({ text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && text) {
                e.preventDefault();
                browserState.set({ text: '' });
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                treeRef.current?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]')?.focus();
              }
            }}
          />
          {text && (
            <button type="button" className="icon-btn search-clear" aria-label="Clear the search" title="Clear the search (Esc)" onClick={() => browserState.set({ text: '' })}>
              <Icon name="close" size="sm" />
            </button>
          )}
        </div>
        {!toolsHost && toolbar}
      </div>

      {showTags && tagChoices.length > 0 && (
        <div className="tag-row" role="group" aria-label="Filter by tag">
          {tagChoices.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={tags.includes(t)} onClick={() => browserState.toggleTag(t)}>
              {t}
            </button>
          ))}
        </div>
      )}

      {showHelp && <p className="browser-help">Click a sound to hear it. Double-click it, or press Enter, to add it to your beat. You can also drag it onto the channel rack.</p>}

      <div className="browser-body" role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${tab}`}>
        {rows.length === 0 ? (
          <p className="empty">{emptyMessage}</p>
        ) : (
          // The tree has one tab stop (the active row); the arrow keys, Enter, Space and Alt+S do the rest.
          // eslint-disable-next-line jsx-a11y/interactive-supports-focus
          <div ref={treeRef} className="tree" role="tree" aria-label="Browser" onKeyDown={onKeyDown}>
            {rows.map((row) => {
              const { node } = row;
              const leaf = node.leaf;
              const isStarred = starred.has(node.id);
              const isCurrentChannel = leaf?.kind === 'channel' && leaf.channelId === selectedChannel;
              const name = node.hint && leaf ? `${node.label}, ${node.hint}` : node.label;
              return (
                // Keys are handled once on the tree (arrows, Enter, Space, Alt+S); a row's click is the pointer path.
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                <div
                  key={node.id}
                  role="treeitem"
                  data-id={node.id}
                  data-kind={node.icon}
                  data-active={node.id === current || undefined}
                  aria-label={name}
                  title={leaf && node.hint ? name : undefined}
                  aria-level={row.depth + 1}
                  aria-posinset={row.posInSet}
                  aria-setsize={row.setSize}
                  aria-expanded={row.expandable ? row.open : undefined}
                  aria-selected={node.id === current}
                  aria-current={isCurrentChannel || undefined}
                  tabIndex={node.id === current ? 0 : -1}
                  className="tree-row"
                  style={{ '--depth': row.depth } as CSSProperties}
                  draggable={leaf?.kind === 'sound'}
                  onDragStart={(e) => {
                    if (leaf?.kind !== 'sound') return;
                    e.dataTransfer.setData(SOUND_DRAG_TYPE, leaf.sound.id);
                    e.dataTransfer.setData('text/plain', leaf.sound.label);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => click(row)}
                  onDoubleClick={() => leaf && activate(row)}
                >
                  <span className="tree-twist" aria-hidden="true">
                    {row.expandable ? <Icon name="chevron" size="sm" /> : null}
                  </span>
                  <span className="tree-icon" aria-hidden="true">
                    <Icon name={iconFor(row)} size="sm" />
                  </span>
                  <span className="tree-label">{node.label}</span>
                  {row.expandable ? (
                    <span className="tree-count" aria-hidden="true">
                      {countLeaves(node)}
                    </span>
                  ) : (
                    node.hint && (
                      <span className="tree-hint" aria-hidden="true">
                        {node.hint}
                      </span>
                    )
                  )}
                  {leaf && leaf.kind !== 'channel' && (
                    <span className="tree-actions">
                      <button
                        type="button"
                        tabIndex={-1}
                        className="icon-btn tree-star"
                        aria-pressed={isStarred}
                        aria-label={isStarred ? `Remove the star from ${node.label}` : `Star ${node.label}`}
                        title={isStarred ? 'Remove the star (Alt+S)' : 'Star it (Alt+S)'}
                        onClick={(e) => {
                          e.stopPropagation();
                          star(row);
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <Icon name={isStarred ? 'star-fill' : 'star'} size="sm" />
                      </button>
                      {leaf.kind === 'sound' && (
                        <button
                          type="button"
                          tabIndex={-1}
                          className="icon-btn"
                          aria-label={`Preview ${node.label}`}
                          title="Preview (Space)"
                          onClick={(e) => {
                            e.stopPropagation();
                            preview(row);
                          }}
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          <Icon name="speaker" size="sm" />
                        </button>
                      )}
                      <button
                        type="button"
                        tabIndex={-1}
                        className="icon-btn"
                        aria-label={leaf.kind === 'sound' ? `Add ${node.label} to the project` : `Open the ${node.label} starter beat`}
                        title={leaf.kind === 'sound' ? 'Add to the project (Enter)' : 'Open this beat (Enter). Undo brings your project back.'}
                        onClick={(e) => {
                          e.stopPropagation();
                          activate(row);
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <Icon name={leaf.kind === 'sound' ? 'plus' : 'play'} size="sm" />
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
