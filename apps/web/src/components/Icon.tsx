/** Small line icons, drawn for Pro Studio. They are decoration: the control that holds one carries the accessible name. */
export type IconName =
  | 'play' | 'pause' | 'stop' | 'undo' | 'redo' | 'plus' | 'minus' | 'close' | 'maximize' | 'restore' | 'chevron' | 'check'
  | 'search' | 'speaker' | 'more' | 'keys' | 'draw' | 'select' | 'erase' | 'pan' | 'sun' | 'moon' | 'zoom-time' | 'zoom-pitch'
  | 'folder' | 'folder-open' | 'project' | 'drum' | 'wave' | 'note' | 'beat' | 'star' | 'star-fill' | 'collapse';

interface Glyph {
  d: string;
  fill?: boolean;
}

const GLYPHS: Record<IconName, Glyph> = {
  play: { d: 'M8 5.5v13l11-6.5z', fill: true },
  pause: { d: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z', fill: true },
  stop: { d: 'M6.5 6.5h11v11h-11z', fill: true },
  undo: { d: 'M9 14 4 9l5-5M4 9h9.5a5.5 5.5 0 0 1 0 11H10' },
  redo: { d: 'm15 14 5-5-5-5M20 9h-9.5a5.5 5.5 0 0 0 0 11H14' },
  plus: { d: 'M12 5v14M5 12h14' },
  minus: { d: 'M5 12h14' },
  close: { d: 'm6 6 12 12M18 6 6 18' },
  maximize: { d: 'M4.5 9V4.5H9M19.5 9V4.5H15M4.5 15v4.5H9M19.5 15v4.5H15' },
  restore: { d: 'M9 4.5V9H4.5M15 4.5V9h4.5M9 19.5V15H4.5M15 19.5V15h4.5' },
  chevron: { d: 'm6 9 6 6 6-6' },
  check: { d: 'm5 12.5 4.5 4.5L19 7' },
  search: { d: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.8-4.8' },
  speaker: { d: 'M4.5 9.5v5h3.5l5 4v-13l-5 4zM16.5 9a4.2 4.2 0 0 1 0 6' },
  more: { d: 'M6 12h.01M12 12h.01M18 12h.01' },
  keys: { d: 'M3.5 6h17v12h-17zM8 6v12M12 6v12M16 6v12' },
  draw: { d: 'm4.5 19.5 1-4L16 5a2 2 0 0 1 3 3L8.5 18.5z' },
  select: { d: 'M5 5h5M14 5h5M5 19h5M14 19h5M5 5v5M5 14v5M19 5v5M19 14v5' },
  erase: { d: 'm9 19-4.5-4.5a2 2 0 0 1 0-3L12 4l7 7-7.5 7.5zM9 19h9' },
  pan: { d: 'M12 3.5v17M3.5 12h17M9 6.5 12 3.5l3 3M9 17.5l3 3 3-3M6.5 9 3.5 12l3 3M17.5 9l3 3-3 3' },
  sun: { d: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4' },
  moon: { d: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z' },
  'zoom-time': { d: 'M4 12h16M7 8.5 4 12l3 3.5M17 8.5l3 3.5-3 3.5' },
  'zoom-pitch': { d: 'M12 4v16M8.5 7 12 4l3.5 3M8.5 17 12 20l3.5-3' },
  folder: { d: 'M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17z' },
  'folder-open': { d: 'M3.5 17V7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h6.5A1.5 1.5 0 0 1 19 9.5v1.5M3.5 17.5l2.2-5.8a1.5 1.5 0 0 1 1.4-1h13.1a1 1 0 0 1 .94 1.35L19.1 17a1.5 1.5 0 0 1-1.4 1H5a1.5 1.5 0 0 1-1.5-.5Z' },
  project: { d: 'M6.5 3.5h7l4 4v13h-11zM13.5 3.5v4h4M9.5 12h5M9.5 15.5h5' },
  drum: { d: 'M6.5 4.5h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2ZM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z' },
  wave: { d: 'M3 12c1.6-6 3.4-6 4.5 0s2.9 6 4.5 0 2.9-6 4.5 0 2.2 4.5 4.5 3' },
  note: { d: 'M9 17.5V6l10-2v11.5M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z' },
  beat: { d: 'M4 6h3.5v3.5H4zM10.25 6h3.5v3.5h-3.5zM16.5 6H20v3.5h-3.5zM4 14.5h3.5V18H4zM10.25 14.5h3.5V18h-3.5zM16.5 14.5H20V18h-3.5z' },
  star: { d: 'm12 3.8 2.5 5.1 5.6.8-4.05 3.95.95 5.6L12 16.6l-5 2.65.95-5.6L3.9 9.7l5.6-.8z' },
  'star-fill': { d: 'm12 3.8 2.5 5.1 5.6.8-4.05 3.95.95 5.6L12 16.6l-5 2.65.95-5.6L3.9 9.7l5.6-.8z', fill: true },
  collapse: { d: 'm7 11 5-5 5 5M7 18l5-5 5 5' },
};

export function Icon({ name, size = 'md' }: { name: IconName; size?: 'sm' | 'md' }) {
  const g = GLYPHS[name];
  return (
    <svg className="icon" data-size={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill={g.fill ? 'currentColor' : 'none'} stroke={g.fill ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={g.d} />
    </svg>
  );
}
