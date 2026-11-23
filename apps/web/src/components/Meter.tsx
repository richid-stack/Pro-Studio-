import { useEffect, useRef } from 'react';
import { meterFall, meterPosition } from '@pro-studio/shared';
import { audioHost } from '../audio/audioHost';

/** Which level a meter follows. */
export type MeterSource = { channel: string } | { master: 'L' | 'R' };

/**
 * A level meter. It reads the engine's telemetry and moves its own element, so a meter never re-renders React.
 * The lit part is a fixed green-to-red scale; a cover slides down to hide the part above the current level.
 */
export function Meter({ source, label, horizontal = false }: { source: MeterSource; label?: string; horizontal?: boolean }) {
  const cover = useRef<HTMLDivElement>(null);
  const channel = 'channel' in source ? source.channel : null;
  const side = 'master' in source ? source.master : null;

  useEffect(() => {
    let level = 0;
    let last = performance.now();
    const paint = (): void => {
      const now = performance.now();
      const m = audioHost.getMeters();
      const raw = channel !== null ? (m.channels[channel] ?? 0) : side === 'L' ? m.masterL : m.masterR;
      level = meterFall(level, meterPosition(raw), now - last);
      last = now;
      if (cover.current) cover.current.style.transform = `${horizontal ? 'scaleX' : 'scaleY'}(${(1 - level).toFixed(3)})`;
    };
    paint();
    return audioHost.subscribeTelemetry(paint);
  }, [channel, side, horizontal]);

  return (
    <div className="meter" data-orientation={horizontal ? 'horizontal' : undefined} role="img" aria-label={label ?? 'Level'}>
      <div className="meter-cover" ref={cover} />
    </div>
  );
}
