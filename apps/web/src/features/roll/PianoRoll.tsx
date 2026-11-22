import { createPortal } from 'react-dom';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  MODE_DEFAULTS, ROLL_MAX_ROW_H, ROLL_MIN_ROW_H, SNAP_OPTIONS, STEP_TICKS, addNote, applyGesture, beginDraw, beginMove, beginResize,
  beginVelocity, centerOnPitch, clamp, deleteNotes, duplicateNotes, findChannel, formatPosition, hitTest, isFeatureVisible, midiName,
  moveNotes, notesInRect, pitchSpan, pitchToY, quantizeNotes, resizeNotes, rollKeyAction, rowCount, setNoteSlide, setNoteVelocity,
  snapToScale, stepToX, velocityBarsAt, velocityFromY, xToStep, yToPitch, zoomX, zoomY,
  type InstrumentChannel, type Project, type Rect, type RollKeyAction, type RollCursor, type RollGesture, type RollView, type ScaleId,
} from '@pro-studio/shared';
import { audioHost } from '../../audio/audioHost';
import { Icon, type IconName } from '../../components/Icon';
import { channelColorValue, fitCanvas, lengthToken, readColors, type CanvasColors } from '../../lib/canvasTheme';
import { pressNote, previewNote, releaseNote } from '../../state/piano';
import { useHeldNotes } from '../../state/keys';
import { preferences } from '../../state/preferences';
import { useStore } from '../../state/store';
import { studio } from '../../state/studio';
import { transport } from '../../state/transport';
import { uiState, useUi, type RollTool } from '../../state/ui';
import { usePreferences } from '../../state/usePreferences';
import { LANE_PAD, paintGrid, paintKeys, paintLane, paintRuler } from './paint';

/** A drag keeps one undo step however long the pointer pauses. */
const ONE_STEP_MS = 3_600_000;
const NOTE_PREVIEW_S = 0.25;
const DEFAULT_VELOCITY = 0.8;
const MIN_FIT_STEP_W = 12;
const MAX_FIT_STEP_W = 40;
/** Fraction of the row-height token a roll row starts at: tighter than a rack row, so more of the keyboard shows. */
const ROW_FRACTION = 0.55;
const DRAG_THRESHOLD_PX = 3;

const TOOLS: ReadonlyArray<{ id: RollTool; label: string; hint: string }> = [
  { id: 'draw', label: 'Draw', hint: 'Draw: click to place a note, drag to set its length. Drag a note to move it.' },
  { id: 'select', label: 'Select', hint: 'Select: drag a box around notes. Shift-click adds to the selection.' },
  { id: 'erase', label: 'Erase', hint: 'Erase: click or drag over notes to delete them. Right-click also deletes.' },
  { id: 'pan', label: 'Pan', hint: 'Pan: drag to scroll. Use this on a touch screen.' },
];

type Drag =
  | { kind: 'gesture'; g: RollGesture; base: Project; key: string; from: { x: number; y: number }; moved: boolean; lastPitch: number }
  | { kind: 'marquee'; from: { x: number; y: number }; keep: ReadonlySet<number> }
  | { kind: 'erase'; key: string }
  | { kind: 'pan'; x: number; y: number; left: number; top: number }
  | { kind: 'velocity'; g: RollGesture; base: Project; key: string };

interface Live {
  channel: InstrumentChannel | null;
  selected: ReadonlySet<number>;
  held: ReadonlySet<number>;
  total: number;
  keyPc: number;
  scale: ScaleId;
  showScale: boolean;
  tool: RollTool;
  /** Snap for gestures; 0 means free. */
  grid: number;
  /** Snap for the keyboard cursor and quantize; never 0. */
  gridSteps: number;
  scaleSnap: boolean;
  lane: boolean;
  follow: boolean;
  numeric: boolean;
}

interface Local {
  view: RollView;
  w: number;
  h: number;
  keysW: number;
  rulerH: number;
  laneH: number;
  ready: boolean;
  centeredFor: string | null;
  cursor: RollCursor;
  marquee: Rect | null;
  focused: boolean;
  colors: CanvasColors | null;
  fontPx: number;
  seq: number;
}

const INITIAL_LOCAL: Local = {
  view: { stepW: 16, rowH: 18, scrollX: 0, scrollY: 0 },
  w: 0, h: 0, keysW: 0, rulerH: 0, laneH: 0, ready: false, centeredFor: null,
  cursor: { step: 0, pitch: 60 }, marquee: null, focused: false, colors: null, fontPx: 11, seq: 0,
};

/** The piano roll: draw, select and erase notes on a pitch-by-time grid, with the keys to play them and a velocity lane. */
export function PianoRoll({ isMobile, toolsHost }: { isMobile: boolean; toolsHost: HTMLElement | null }) {
  const { mode } = usePreferences();
  const channels = useStore(studio.store, (h) => h.present.channels);
  const bars = useStore(studio.store, (h) => h.present.bars);
  const keyPc = useStore(studio.store, (h) => h.present.key);
  const scale = useStore(studio.store, (h) => h.present.scale);
  const selectedId = useUi((s) => s.selectedChannelId);
  const tool = useUi((s) => s.tool);
  const snap = useUi((s) => s.snap);
  const selected = useUi((s) => s.selectedNotes);
  const held = useHeldNotes();
  const [showScale, setShowScale] = useState(true);
  const [follow, setFollow] = useState(true);
  const helpId = useId();

  const instruments = useMemo(() => channels.filter((c): c is InstrumentChannel => c.type === 'inst'), [channels]);
  const channel = instruments.find((c) => c.id === selectedId) ?? null;
  const snapDef = SNAP_OPTIONS.find((o) => o.id === snap) ?? SNAP_OPTIONS[3];
  const lane = isFeatureVisible('velocity-lane', mode);
  const canSlide = isFeatureVisible('per-note-properties', mode);

  const live = useRef<Live>({} as Live);
  live.current = {
    channel, selected, held, total: bars * 16, keyPc, scale, showScale, tool,
    grid: snap === 'off' ? 0 : snapDef.steps, gridSteps: snapDef.steps,
    scaleSnap: MODE_DEFAULTS[mode].scaleSnap, lane, follow, numeric: isFeatureVisible('numeric-readouts', mode),
  };

  const st = useRef<Local>({ ...INITIAL_LOCAL });
  const drag = useRef<Drag | null>(null);
  const keyDrag = useRef<{ id: number; pitch: number } | null>(null);
  const raf = useRef(0);

  const scrollEl = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const viewEl = useRef<HTMLDivElement>(null);
  const gridCv = useRef<HTMLCanvasElement>(null);
  const rulerCv = useRef<HTMLCanvasElement>(null);
  const keysCv = useRef<HTMLCanvasElement>(null);
  const laneCv = useRef<HTMLCanvasElement>(null);
  const headEl = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLOutputElement>(null);

  /* ------------------------------------------------------------ drawing */

  const paintHead = (): void => {
    const s = st.current;
    const head = headEl.current;
    const sc = scrollEl.current;
    if (!head || !sc) return;
    const t = audioHost.getTransport();
    const step = t.loopTick / STEP_TICKS;
    const x = stepToX(step, s.view);
    head.style.transform = `translateX(${x}px)`;
    head.style.opacity = x < 0 || x > s.w ? '0' : t.playing || t.loopTick > 0 ? '1' : '0.6';
    if (live.current.follow && t.playing && (x > s.w - 24 || x < 0)) sc.scrollLeft = Math.max(0, step * s.view.stepW - s.w * 0.1);
  };

  const paintAll = (): void => {
    const s = st.current;
    const L = live.current;
    const host = viewEl.current;
    if (!host || s.w === 0 || s.h === 0) return;
    // the view's numbers on the element: the end-to-end tests turn pixels into steps and pitches with them
    host.dataset.stepW = String(s.view.stepW);
    host.dataset.rowH = String(s.view.rowH);
    host.dataset.scrollX = String(Math.round(s.view.scrollX));
    host.dataset.scrollY = String(Math.round(s.view.scrollY));
    const c = (s.colors ??= readColors(host));
    const color = channelColorValue(host, L.channel?.color ?? 'ch-1');
    const notes = L.channel?.notes ?? [];

    const gctx = gridCv.current ? fitCanvas(gridCv.current, s.w, s.h) : null;
    if (gctx) {
      paintGrid({
        ctx: gctx, w: s.w, h: s.h, view: s.view, c, notes, selected: L.selected, color, total: L.total, keyPc: L.keyPc, scale: L.scale,
        showScale: L.showScale, cursor: s.focused ? { ...s.cursor, w: L.gridSteps } : null, marquee: s.marquee, fontPx: s.fontPx,
      });
    }
    const rctx = rulerCv.current && s.rulerH > 0 ? fitCanvas(rulerCv.current, s.w, s.rulerH) : null;
    if (rctx) paintRuler({ ctx: rctx, w: s.w, h: s.rulerH, view: s.view, c }, L.total, s.fontPx);
    const kctx = keysCv.current && s.keysW > 0 ? fitCanvas(keysCv.current, s.keysW, s.h) : null;
    if (kctx) paintKeys({ ctx: kctx, w: s.keysW, h: s.h, view: s.view, c, held: L.held, keyPc: L.keyPc, scale: L.scale, showScale: L.showScale, fontPx: s.fontPx });
    const lctx = laneCv.current && s.laneH > 0 ? fitCanvas(laneCv.current, s.w, s.laneH) : null;
    if (lctx) paintLane({ ctx: lctx, w: s.w, h: s.laneH, view: s.view, c, notes, selected: L.selected, color, total: L.total });
    paintHead();
  };

  const schedule = (): void => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      fns.current.paintAll();
    });
  };

  /** Set the view, size the scroll area to match, and scroll there. The scroll event then confirms the clamped values. */
  const applyView = (next: RollView): void => {
    const s = st.current;
    const sc = scrollEl.current;
    if (!sc || !spacer.current) return;
    spacer.current.style.width = `${live.current.total * next.stepW}px`;
    spacer.current.style.height = `${rowCount() * next.rowH}px`;
    sc.scrollLeft = next.scrollX;
    sc.scrollTop = next.scrollY;
    s.view = { ...next, scrollX: sc.scrollLeft, scrollY: sc.scrollTop };
    schedule();
  };

  const centerOnNotes = (): void => {
    const s = st.current;
    const span = pitchSpan(live.current.channel?.notes ?? []);
    applyView(centerOnPitch(s.view, Math.round((span.low + span.high) / 2), s.h));
    s.cursor = { step: 0, pitch: Math.round((span.low + span.high) / 2) };
  };

  const measure = (): void => {
    const s = st.current;
    const sc = scrollEl.current;
    const host = viewEl.current;
    if (!sc || !host) return;
    s.w = sc.clientWidth;
    s.h = sc.clientHeight;
    host.style.width = `${s.w}px`;
    host.style.height = `${s.h}px`;
    if (rulerCv.current) {
      rulerCv.current.style.width = `${s.w}px`;
      s.rulerH = rulerCv.current.clientHeight;
    }
    if (keysCv.current) {
      keysCv.current.style.height = `${s.h}px`;
      s.keysW = keysCv.current.parentElement?.clientWidth ?? 0;
    }
    if (laneCv.current) {
      laneCv.current.style.width = `${s.w}px`;
      s.laneH = laneCv.current.clientHeight;
    }
    s.fontPx = lengthToken(host, '--text-xs') || 11;
    if (!s.ready && s.w > 0) {
      s.ready = true;
      const rowH = clamp(Math.round(lengthToken(host, '--row-h') * ROW_FRACTION), ROLL_MIN_ROW_H, ROLL_MAX_ROW_H);
      s.view = { stepW: clamp(s.w / live.current.total, MIN_FIT_STEP_W, MAX_FIT_STEP_W), rowH, scrollX: 0, scrollY: 0 };
      s.centeredFor = null;
    }
    if (s.ready && s.centeredFor !== (live.current.channel?.id ?? '')) {
      s.centeredFor = live.current.channel?.id ?? '';
      centerOnNotes();
    }
    schedule();
  };

  const fns = useRef({ paintAll, paintHead, measure, applyView, schedule });
  fns.current = { paintAll, paintHead, measure, applyView, schedule };

  const hasChannel = channel !== null;

  useLayoutEffect(() => {
    // after every render: keep the spacer's size in step with the pattern length, then redraw
    if (spacer.current) {
      spacer.current.style.width = `${live.current.total * st.current.view.stepW}px`;
      spacer.current.style.height = `${rowCount() * st.current.view.rowH}px`;
    }
    if (st.current.ready && st.current.centeredFor !== (channel?.id ?? '')) fns.current.measure();
    fns.current.schedule();
  });

  useEffect(() => {
    const sc = scrollEl.current;
    if (!sc) return;
    st.current.ready = false;
    const ro = new ResizeObserver(() => fns.current.measure());
    ro.observe(sc);
    fns.current.measure();
    const offTelemetry = audioHost.subscribeTelemetry(() => fns.current.paintHead());
    const offPrefs = preferences.subscribe(() => {
      st.current.colors = null;
      fns.current.schedule();
    });
    const onWheel = (e: WheelEvent): void => {
      if (!(e.ctrlKey || e.metaKey || e.altKey)) return;
      e.preventDefault();
      const s = st.current;
      const r = viewEl.current?.getBoundingClientRect();
      if (!r) return;
      const f = Math.exp(-e.deltaY * 0.0025);
      fns.current.applyView(e.altKey && !e.ctrlKey && !e.metaKey ? zoomY(s.view, f, e.clientY - r.top, s.h) : zoomX(s.view, f, e.clientX - r.left, s.w, live.current.total));
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      offTelemetry();
      offPrefs();
      sc.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [hasChannel, lane]);

  /* ------------------------------------------------------------ editing */

  const channelNow = (): InstrumentChannel | null => {
    const id = live.current.channel?.id;
    const c = id ? findChannel(studio.get(), id) : undefined;
    return c?.type === 'inst' ? c : null;
  };
  const gestureKey = (): string => `roll:${++st.current.seq}`;
  const edit = (fn: (p: Project) => Project, key: string): void => studio.edit(fn, { key, coalesceMs: ONE_STEP_MS });
  const local = (e: { clientX: number; clientY: number }, el: Element | null): { x: number; y: number } => {
    const r = el?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const pointAt = (x: number, y: number): { step: number; pitch: number } => ({ step: xToStep(x, st.current.view), pitch: yToPitch(y, st.current.view) });
  const select = (ids: Iterable<number>): void => {
    uiState.selectNotes(ids);
    fns.current.schedule();
  };

  const eraseAt = (x: number, y: number, key: string): void => {
    const ch = channelNow();
    if (!ch) return;
    const hit = hitTest(ch.notes, x, y, st.current.view);
    if (!hit) return;
    edit((p) => deleteNotes(p, ch.id, new Set([hit.id])), key);
    select([...uiState.get().selectedNotes].filter((id) => id !== hit.id));
  };

  const onGridDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const L = live.current;
    const ch = channelNow();
    if (!ch) return;
    scrollEl.current?.focus({ preventScroll: true });
    const { x, y } = local(e, viewEl.current);
    if (e.button === 2) {
      eraseAt(x, y, gestureKey());
      return;
    }
    if (e.button !== 0) return;
    const sc = scrollEl.current;
    const touchPan = L.tool === 'pan' && e.pointerType === 'touch';
    if (!touchPan) e.currentTarget.setPointerCapture(e.pointerId);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const hit = hitTest(ch.notes, x, y, st.current.view);

    if (L.tool === 'pan') {
      if (!touchPan && sc) drag.current = { kind: 'pan', x: e.clientX, y: e.clientY, left: sc.scrollLeft, top: sc.scrollTop };
      return;
    }
    if (L.tool === 'erase') {
      const key = gestureKey();
      drag.current = { kind: 'erase', key };
      eraseAt(x, y, key);
      return;
    }
    if (hit) {
      const current = uiState.get().selectedNotes;
      if (additive) {
        const next = new Set(current);
        if (!next.delete(hit.id)) next.add(hit.id);
        select(next);
        return;
      }
      const ids = current.has(hit.id) ? new Set(current) : new Set([hit.id]);
      if (!current.has(hit.id)) select(ids);
      const point = pointAt(x, y);
      const g = hit.zone === 'end' ? beginResize(ids, ch.id, point, L.grid) : beginMove(ids, ch.id, point, L.grid);
      drag.current = { kind: 'gesture', g, base: studio.get(), key: gestureKey(), from: { x, y }, moved: false, lastPitch: point.pitch };
      const note = ch.notes.find((n) => n.id === hit.id);
      if (note) previewNote(ch.id, note.n, note.v, NOTE_PREVIEW_S);
      return;
    }
    if (L.tool === 'draw') {
      const point = pointAt(x, y);
      const project = studio.get();
      const pitch = L.scaleSnap ? snapToScale(point.pitch, project.key, project.scale) : point.pitch;
      const r = beginDraw(project, ch.id, { step: point.step, pitch }, L.grid, DEFAULT_VELOCITY);
      if (r.gesture.kind !== 'draw' || r.project === project) return;
      const key = gestureKey();
      edit(() => r.project, key);
      select([r.gesture.noteId]);
      previewNote(ch.id, pitch, DEFAULT_VELOCITY, NOTE_PREVIEW_S);
      drag.current = { kind: 'gesture', g: r.gesture, base: r.project, key, from: { x, y }, moved: true, lastPitch: pitch };
      return;
    }
    // select tool on empty space: start a box
    if (!additive) select([]);
    drag.current = { kind: 'marquee', from: { x, y }, keep: additive ? new Set(uiState.get().selectedNotes) : new Set() };
    st.current.marquee = { x1: x, y1: y, x2: x, y2: y };
    fns.current.schedule();
  };

  const onGridMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const s = st.current;
    const { x, y } = local(e, viewEl.current);
    const d = drag.current;
    const ch = channelNow();
    if (!d) {
      // hovering: show what a press would do, and where the pointer is
      const el = viewEl.current;
      if (el && ch) {
        const hit = hitTest(ch.notes, x, y, s.view);
        const t = live.current.tool;
        el.style.cursor = t === 'pan' ? 'grab' : t === 'erase' ? 'crosshair' : hit ? (hit.zone === 'end' ? 'ew-resize' : 'move') : t === 'draw' ? 'crosshair' : 'default';
      }
      if (readout.current) {
        const p = pointAt(x, y);
        readout.current.textContent = `${midiName(p.pitch)}${live.current.numeric ? ` (${p.pitch})` : ''}  ${formatPosition(Math.max(0, p.step))}`;
      }
      return;
    }
    if (!ch) return;
    switch (d.kind) {
      case 'gesture': {
        if (!d.moved && Math.hypot(x - d.from.x, y - d.from.y) < DRAG_THRESHOLD_PX) return;
        d.moved = true;
        const to = pointAt(x, y);
        const next = applyGesture(d.base, d.g, to);
        edit(() => next, d.key);
        if (d.g.kind !== 'resize' && to.pitch !== d.lastPitch) {
          d.lastPitch = to.pitch;
          previewNote(ch.id, to.pitch, DEFAULT_VELOCITY, NOTE_PREVIEW_S);
        }
        break;
      }
      case 'marquee': {
        s.marquee = { x1: d.from.x, y1: d.from.y, x2: x, y2: y };
        select([...d.keep, ...notesInRect(ch.notes, s.marquee, s.view)]);
        break;
      }
      case 'erase':
        eraseAt(x, y, d.key);
        break;
      case 'pan': {
        const sc = scrollEl.current;
        if (sc) {
          sc.scrollLeft = d.left - (e.clientX - d.x);
          sc.scrollTop = d.top - (e.clientY - d.y);
        }
        break;
      }
      case 'velocity':
        break;
    }
  };

  const onGridUp = (): void => {
    if (drag.current?.kind === 'marquee') st.current.marquee = null;
    drag.current = null;
    fns.current.schedule();
  };

  const onLaneDown = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    const ch = channelNow();
    if (!ch) return;
    const { x, y } = local(e, laneCv.current);
    const bars = velocityBarsAt(ch.notes, x, st.current.view);
    if (bars.length === 0) return;
    const current = uiState.get().selectedNotes;
    const grabbed = bars.some((id) => current.has(id));
    const ids = grabbed ? new Set(current) : new Set(bars);
    if (!grabbed) select(ids);
    e.currentTarget.setPointerCapture(e.pointerId);
    const d: Drag = { kind: 'velocity', g: beginVelocity(ids, ch.id), base: studio.get(), key: gestureKey() };
    drag.current = d;
    setVelocity(d, y);
  };
  const setVelocity = (d: Extract<Drag, { kind: 'velocity' }>, y: number): void => {
    const value = velocityFromY(y - LANE_PAD, st.current.laneH - LANE_PAD);
    edit(() => applyGesture(d.base, d.g, { step: 0, pitch: 0 }, value), d.key);
  };
  const onLaneMove = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    const d = drag.current;
    if (d?.kind === 'velocity') setVelocity(d, local(e, laneCv.current).y);
  };

  const onKeysDown = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (e.button !== 0) return;
    const pitch = yToPitch(local(e, keysCv.current).y, st.current.view);
    e.currentTarget.setPointerCapture(e.pointerId);
    keyDrag.current = { id: e.pointerId, pitch };
    pressNote(e.pointerId, pitch);
  };
  const onKeysMove = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    const k = keyDrag.current;
    if (!k || k.id !== e.pointerId) return;
    const pitch = yToPitch(local(e, keysCv.current).y, st.current.view);
    if (pitch === k.pitch) return;
    releaseNote(k.id);
    k.pitch = pitch;
    pressNote(k.id, pitch);
  };
  const onKeysUp = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    const k = keyDrag.current;
    if (!k || k.id !== e.pointerId) return;
    keyDrag.current = null;
    releaseNote(k.id);
  };

  const seekTo = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    const { x } = local(e, rulerCv.current);
    const step = clamp(Math.floor(xToStep(x, st.current.view)), 0, live.current.total - 1);
    transport.seek(step * STEP_TICKS);
  };

  /* ------------------------------------------------------------ keyboard */

  const ensureVisible = (): void => {
    const s = st.current;
    const sc = scrollEl.current;
    if (!sc) return;
    const x = stepToX(s.cursor.step, s.view);
    const right = x + live.current.gridSteps * s.view.stepW;
    const y = pitchToY(s.cursor.pitch, s.view);
    if (x < 0) sc.scrollLeft += x - 8;
    else if (right > s.w) sc.scrollLeft += right - s.w + 8;
    if (y < 0) sc.scrollTop += y - 8;
    else if (y + s.view.rowH > s.h) sc.scrollTop += y + s.view.rowH - s.h + 8;
  };

  const runKey = (ch: InstrumentChannel, act: RollKeyAction, sel: ReadonlySet<number>): void => {
    const s = st.current;
    const L = live.current;
    const say = uiState.announce;
    switch (act.type) {
      case 'cursor': {
        const moved = act.cursor.pitch !== s.cursor.pitch;
        s.cursor = act.cursor;
        ensureVisible();
        if (moved) previewNote(ch.id, act.cursor.pitch, DEFAULT_VELOCITY, 0.15);
        const here = ch.notes.some((n) => n.n === act.cursor.pitch && act.cursor.step >= n.t - 1e-9 && act.cursor.step < n.t + n.d - 1e-9);
        say(`${midiName(act.cursor.pitch)}, ${formatPosition(act.cursor.step)}${here ? ', note' : ''}`);
        break;
      }
      case 'add': {
        const existing = ch.notes.find((n) => n.n === act.at.pitch && act.at.step >= n.t - 1e-9 && act.at.step < n.t + n.d - 1e-9);
        if (existing) {
          select([existing.id]);
          say(`Selected ${midiName(existing.n)} at ${formatPosition(existing.t)}. Press Delete to remove it.`);
          break;
        }
        const r = addNote(studio.get(), ch.id, { t: act.at.step, d: L.gridSteps, n: act.at.pitch, v: DEFAULT_VELOCITY, s: false });
        studio.edit(() => r.project);
        select([r.id]);
        previewNote(ch.id, act.at.pitch, DEFAULT_VELOCITY, NOTE_PREVIEW_S);
        say(`Added ${midiName(act.at.pitch)} at ${formatPosition(act.at.step)}`);
        break;
      }
      case 'delete':
        studio.edit((p) => deleteNotes(p, ch.id, sel));
        select([]);
        say(`Deleted ${sel.size} ${sel.size === 1 ? 'note' : 'notes'}. Press Undo to bring ${sel.size === 1 ? 'it' : 'them'} back.`);
        break;
      case 'move': {
        studio.edit((p) => moveNotes(p, ch.id, sel, act.dStep, act.dPitch), { key: 'roll-key-move' });
        if (act.dPitch !== 0) {
          const first = ch.notes.find((n) => sel.has(n.id));
          if (first) previewNote(ch.id, first.n + act.dPitch, first.v, 0.15);
        }
        break;
      }
      case 'resize':
        studio.edit((p) => resizeNotes(p, ch.id, sel, act.dSteps), { key: 'roll-key-resize' });
        break;
      case 'select-all':
        select(ch.notes.map((n) => n.id));
        say(`Selected ${ch.notes.length} ${ch.notes.length === 1 ? 'note' : 'notes'}`);
        break;
      case 'clear-selection':
        select([]);
        break;
      case 'duplicate': {
        const picked = ch.notes.filter((n) => sel.has(n.id));
        const span = Math.max(...picked.map((n) => n.t + n.d)) - Math.min(...picked.map((n) => n.t));
        const shift = Math.ceil(span / L.gridSteps - 1e-9) * L.gridSteps;
        const r = duplicateNotes(studio.get(), ch.id, sel, shift);
        if (r.ids.length === 0) {
          say('No room to duplicate. The copy would fall past the end of the pattern.');
          break;
        }
        studio.edit(() => r.project);
        select(r.ids);
        say(`Duplicated ${r.ids.length} ${r.ids.length === 1 ? 'note' : 'notes'}`);
        break;
      }
      case 'velocity':
        studio.edit(
          (p) => ch.notes.filter((n) => sel.has(n.id)).reduce((acc, n) => setNoteVelocity(acc, ch.id, new Set([n.id]), clamp(n.v + act.delta, 0.05, 1)), p),
          { key: 'roll-key-velocity' },
        );
        break;
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return;
    const ch = channelNow();
    if (!ch) return;
    const sel = new Set([...uiState.get().selectedNotes].filter((id) => ch.notes.some((n) => n.id === id)));
    const act = rollKeyAction(
      { key: e.key, shift: e.shiftKey, mod: e.ctrlKey || e.metaKey, alt: e.altKey },
      { cursor: st.current.cursor, grid: live.current.gridSteps, total: live.current.total, hasSelection: sel.size > 0 },
    );
    if (!act) return; // not a roll key: the typing piano and the app's shortcuts get it
    e.preventDefault();
    runKey(ch, act, sel);
  };

  /* ------------------------------------------------------------ toolbar */

  const selectionOrAll = (ch: InstrumentChannel): ReadonlySet<number> => {
    const sel = uiState.get().selectedNotes;
    const inChannel = ch.notes.filter((n) => sel.has(n.id)).map((n) => n.id);
    return new Set(inChannel.length > 0 ? inChannel : ch.notes.map((n) => n.id));
  };
  const quantize = (): void => {
    const ch = channelNow();
    if (!ch || ch.notes.length === 0) return;
    const ids = selectionOrAll(ch);
    studio.edit((p) => quantizeNotes(p, ch.id, ids, live.current.gridSteps));
    uiState.announce(`Quantized ${ids.size} ${ids.size === 1 ? 'note' : 'notes'} to ${snapDef.label}`);
  };
  const selectedInChannel = channel ? channel.notes.filter((n) => selected.has(n.id)) : [];
  const allSlide = selectedInChannel.length > 0 && selectedInChannel.every((n) => n.s);
  const toggleSlide = (): void => {
    const ch = channelNow();
    if (!ch || selectedInChannel.length === 0) return;
    studio.edit((p) => setNoteSlide(p, ch.id, new Set(selectedInChannel.map((n) => n.id)), !allSlide));
  };
  const zoom = (axis: 'time' | 'pitch', factor: number): void => {
    const s = st.current;
    fns.current.applyView(axis === 'time' ? zoomX(s.view, factor, s.w / 2, s.w, live.current.total) : zoomY(s.view, factor, s.h / 2, s.h));
  };

  /* ------------------------------------------------------------ render */

  const toolbar = (
    <div className="roll-toolbar" role="toolbar" aria-label="Piano roll tools">
      {instruments.length > 0 && (
        <label className="field-inline">
          <span className="visually-hidden">Channel to edit</span>
          <select className="select select-wide" value={channel?.id ?? ''} onChange={(e) => uiState.selectChannel(e.target.value)}>
            {!channel && (
              <option value="" disabled>
                Choose a channel
              </option>
            )}
            {instruments.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="roll-group" role="group" aria-label="Tool">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" className="icon-btn" aria-pressed={tool === t.id} aria-label={t.label} title={t.hint} onClick={() => uiState.setTool(t.id)}>
            <Icon name={t.id as IconName} />
          </button>
        ))}
      </div>
      <label className="field-inline">
        <span className="field-label">Snap</span>
        <select className="select" value={snap} onChange={(e) => uiState.setSnap(e.target.value as typeof snap)}>
          {SNAP_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn" disabled={!channel || channel.notes.length === 0} onClick={quantize} title="Snap note starts to the grid. Applies to the selected notes, or to all of them when none are selected.">
        Quantize
      </button>
      {canSlide && (
        <button type="button" className="btn btn-chip" aria-pressed={allSlide} disabled={selectedInChannel.length === 0} onClick={toggleSlide} title="Slide: the selected notes glide in from the note before them.">
          Slide
        </button>
      )}
      <div className="roll-group" role="group" aria-label="Zoom">
        <button type="button" className="icon-btn" aria-label="Zoom out time" title="Zoom out time (Ctrl and scroll)" onClick={() => zoom('time', 1 / 1.25)}>
          <Icon name="minus" />
        </button>
        <Icon name="zoom-time" size="sm" />
        <button type="button" className="icon-btn" aria-label="Zoom in time" title="Zoom in time (Ctrl and scroll)" onClick={() => zoom('time', 1.25)}>
          <Icon name="plus" />
        </button>
        {!isMobile && (
          <>
            <button type="button" className="icon-btn" aria-label="Zoom out pitch" title="Fewer, shorter rows (Alt and scroll)" onClick={() => zoom('pitch', 1 / 1.25)}>
              <Icon name="minus" />
            </button>
            <Icon name="zoom-pitch" size="sm" />
            <button type="button" className="icon-btn" aria-label="Zoom in pitch" title="Taller rows (Alt and scroll)" onClick={() => zoom('pitch', 1.25)}>
              <Icon name="plus" />
            </button>
          </>
        )}
      </div>
      <button type="button" className="btn btn-chip" aria-pressed={showScale} onClick={() => setShowScale((v) => !v)} title="Dim the rows outside the project key and scale, and mark the key's notes on the keyboard.">
        Scale
      </button>
      <button type="button" className="btn btn-chip" aria-pressed={follow} onClick={() => setFollow((v) => !v)} title="Scroll the roll to keep the playhead in view while playing.">
        Follow
      </button>
      <output ref={readout} className="roll-readout" aria-hidden="true" />
    </div>
  );

  const hint = channel
    ? `Piano roll for ${channel.name}, ${channel.notes.length} ${channel.notes.length === 1 ? 'note' : 'notes'}. Arrow keys move the cursor, Enter places a note, Shift and arrows move the selected notes, Alt and left or right arrows change their length, Delete removes them.`
    : '';

  return (
    <div className="roll" data-tool={tool} data-mobile={isMobile || undefined} data-header-tools={toolsHost ? '' : undefined}>
      {toolsHost ? createPortal(toolbar, toolsHost) : toolbar}
      {channel ? (
        <div className="roll-body" data-lane={lane ? 'on' : 'off'}>
          <div className="roll-corner" aria-hidden="true" />
          <canvas ref={rulerCv} className="roll-ruler" aria-hidden="true" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seekTo(e); }} onPointerMove={(e) => e.buttons === 1 && seekTo(e)} />
          <div className="roll-keys">
            <canvas ref={keysCv} aria-hidden="true" onPointerDown={onKeysDown} onPointerMove={onKeysMove} onPointerUp={onKeysUp} onPointerCancel={onKeysUp} />
          </div>
          {/* The roll is one custom widget with its own keys (see rollKeys), so it is an application region; its notes are also listed for screen readers below. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            ref={scrollEl}
            className="roll-scroll"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            role="application"
            aria-roledescription="piano roll"
            aria-label={`Notes, ${channel.name}`}
            aria-describedby={helpId}
            onKeyDown={onKeyDown}
            onFocus={() => { st.current.focused = true; schedule(); }}
            onBlur={() => { st.current.focused = false; schedule(); }}
            onScroll={(e) => {
              const el = e.currentTarget;
              st.current.view = { ...st.current.view, scrollX: el.scrollLeft, scrollY: el.scrollTop };
              schedule();
            }}
          >
            <div className="roll-stage">
              <div ref={spacer} className="roll-spacer" />
              <div
                ref={viewEl}
                className="roll-view"
                onPointerDown={onGridDown}
                onPointerMove={onGridMove}
                onPointerUp={onGridUp}
                onPointerCancel={onGridUp}
                onContextMenu={(e) => e.preventDefault()}
              >
                <canvas ref={gridCv} aria-hidden="true" />
                <div ref={headEl} className="roll-head" aria-hidden="true" />
              </div>
            </div>
          </div>
          {lane && (
            <>
              <div className="roll-lane-label" aria-hidden="true">Velocity</div>
              <div className="roll-lane">
                <canvas ref={laneCv} aria-label="Velocity of each note. Drag a bar up or down." onPointerDown={onLaneDown} onPointerMove={onLaneMove} onPointerUp={onGridUp} onPointerCancel={onGridUp} />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="empty">
          {instruments.length === 0
            ? 'The piano roll edits instrument channels. Add one from the browser (Sub 808, Rhodes, Pluck, Pad or Organ) to write notes.'
            : 'The piano roll edits instrument channels. Choose one above. Drum channels use the step grid in the channel rack.'}
        </div>
      )}
      <p id={helpId} className="visually-hidden">{hint}</p>
      {channel && (
        <ul className="visually-hidden" aria-label="Notes in this channel">
          {channel.notes.slice(0, 256).map((n) => (
            <li key={n.id}>
              {midiName(n.n)}, {formatPosition(n.t)}, {n.d} {n.d === 1 ? 'step' : 'steps'} long, velocity {Math.round(n.v * 100)} percent{selected.has(n.id) ? ', selected' : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
