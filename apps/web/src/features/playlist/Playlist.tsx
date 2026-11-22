import { useEffect, useLayoutEffect, useRef } from 'react';
import { STEPS_PER_BAR, STEP_TICKS, totalSteps, type Channel, type Project } from '@pro-studio/shared';
import { audioHost } from '../../audio/audioHost';
import { channelColorValue, fitCanvas, lengthToken, readColors } from '../../lib/canvasTheme';
import { preferences } from '../../state/preferences';
import { useProject } from '../../state/studio';
import { transport } from '../../state/transport';

function drawPattern(canvas: HTMLCanvasElement, project: Project, width: number, height: number, lane: number): void {
  const ctx = fitCanvas(canvas, width, height);
  if (!ctx) return;
  const c = readColors(canvas);
  const steps = totalSteps(project);
  const per = width / steps;
  ctx.fillStyle = c.surface;
  ctx.fillRect(0, 0, width, height);
  project.channels.forEach((ch: Channel, i) => {
    const y = i * lane;
    if (i % 2 === 1) {
      ctx.fillStyle = c.rowBlack;
      ctx.fillRect(0, y, width, lane);
    }
    ctx.fillStyle = channelColorValue(canvas, ch.color);
    if (ch.type === 'drum') {
      ch.v.forEach((v, s) => {
        if (v <= 0 || s >= steps) return;
        ctx.globalAlpha = 0.45 + v * 0.55;
        ctx.fillRect(s * per + 0.5, y + 3, Math.max(1, per - 1), lane - 6);
      });
    } else if (ch.notes.length > 0) {
      const lo = Math.min(...ch.notes.map((n) => n.n));
      const hi = Math.max(...ch.notes.map((n) => n.n));
      const span = Math.max(1, hi - lo);
      for (const n of ch.notes) {
        ctx.globalAlpha = 0.45 + n.v * 0.55;
        const ny = y + 3 + (1 - (n.n - lo) / span) * (lane - 9);
        ctx.fillRect(n.t * per, ny, Math.max(1.5, n.d * per - 1), 3);
      }
    }
    ctx.globalAlpha = 1;
  });
  // bar and beat lines over the top
  for (let s = 0; s <= steps; s += 4) {
    ctx.fillStyle = s % STEPS_PER_BAR === 0 ? c.gridBar : c.gridBeat;
    ctx.fillRect(Math.round(s * per), 0, 1, height);
  }
}

/**
 * An honest preview of the arrangement: the one pattern that loops, with every channel on its own lane.
 * Click the ruler to move the playhead. Placing several patterns along a timeline is on the roadmap (docs/ROADMAP.md).
 */
export function Playlist() {
  const project = useProject();
  const area = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const size = useRef({ w: 0, h: 0, lane: 0 });
  const steps = totalSteps(project);
  const bars = project.bars;

  const redraw = (): void => {
    const a = area.current;
    const cv = canvas.current;
    if (!a || !cv) return;
    const lane = size.current.lane || lengthToken(a, '--row-h');
    const w = a.clientWidth;
    const h = Math.max(a.clientHeight, project.channels.length * lane);
    size.current = { w, h, lane };
    cv.style.height = `${h}px`;
    drawPattern(cv, project, w, h, lane);
  };

  useLayoutEffect(redraw);
  useEffect(() => {
    const a = area.current;
    if (!a) return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(a);
    const off = preferences.subscribe(() => requestAnimationFrame(redraw));
    return () => {
      ro.disconnect();
      off();
    };
    // redraw reads the latest project through the render closure, so re-subscribing per project keeps it current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  useEffect(() => {
    const paint = (): void => {
      const t = audioHost.getTransport();
      const el = head.current;
      if (!el) return;
      el.style.transform = `translateX(${(t.loopTick / STEP_TICKS / steps) * size.current.w}px)`;
      el.style.opacity = t.playing || t.loopTick > 0 ? '1' : '0.6';
    };
    paint();
    return audioHost.subscribeTelemetry(paint);
  }, [steps]);

  const seek = (clientX: number): void => {
    const r = area.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const frac = Math.min(0.999, Math.max(0, (clientX - r.left) / r.width));
    transport.seek(Math.floor(frac * steps) * STEP_TICKS);
  };

  return (
    <div className="playlist">
      <p className="playlist-note">
        This is a preview. One pattern loops, and each channel has its own lane. Placing several patterns along a timeline is on the roadmap.
      </p>
      <div className="playlist-grid">
        <div className="playlist-corner" aria-hidden="true" />
        <div
          className="playlist-ruler"
          role="slider"
          tabIndex={0}
          aria-label="Playhead position. Use the arrow keys to move one step."
          aria-valuemin={0}
          aria-valuemax={steps - 1}
          aria-valuenow={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            seek(e.clientX);
          }}
          onPointerMove={(e) => e.buttons === 1 && seek(e.clientX)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const cur = audioHost.getTransport().loopTick;
            const next = Math.max(0, Math.min(steps * STEP_TICKS - STEP_TICKS, cur + (e.key === 'ArrowRight' ? STEP_TICKS : -STEP_TICKS) * (e.shiftKey ? 4 : 1)));
            transport.seek(next);
          }}
        >
          {Array.from({ length: bars }, (_, i) => (
            <span key={i} className="ruler-bar" style={{ left: `${(i / bars) * 100}%` }}>{i + 1}</span>
          ))}
        </div>
        <ul className="playlist-lanes" aria-label="Channels in the pattern">
          {project.channels.map((c) => (
            <li key={c.id} className="lane-name" style={{ '--ch': `var(--${c.color})` } as React.CSSProperties}>{c.name}</li>
          ))}
        </ul>
        <div className="playlist-area" ref={area} aria-hidden="true">
          <canvas ref={canvas} className="playlist-canvas" />
          <div className="playlist-head" ref={head} />
        </div>
      </div>
    </div>
  );
}

