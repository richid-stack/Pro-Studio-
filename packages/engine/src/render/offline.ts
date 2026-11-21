import { EngineHost } from '../host';
import type { HostCommand } from '../protocol';

export interface OfflineOptions {
  sampleRate?: number;
  seconds: number;
  /** Frames per block. Output must not depend on it; tests vary it to prove that. Default 128, the worklet quantum. */
  blockSize?: number;
  /** Commands sent before rendering starts, in order. Include `play` to start the transport. */
  commands: readonly HostCommand[];
  /** Commands that take effect at a given time in seconds (rounded to a block boundary), for mid-render changes. */
  timed?: ReadonlyArray<{ atSeconds: number; command: HostCommand }>;
}

export interface OfflineResult {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
  host: EngineHost;
}

/** Render a project or a command script to audio with no sound card: the basis of export, tests and server rendering. */
export function renderOffline(o: OfflineOptions): OfflineResult {
  const sampleRate = o.sampleRate ?? 44100;
  const total = Math.round(o.seconds * sampleRate);
  const block = Math.max(1, o.blockSize ?? 128);
  const host = new EngineHost(sampleRate);
  for (const c of o.commands) host.handle(c);
  const timed = [...(o.timed ?? [])].sort((a, b) => a.atSeconds - b.atSeconds);
  let next = 0;
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  const bl = new Float32Array(block);
  const br = new Float32Array(block);
  for (let done = 0; done < total; done += block) {
    const n = Math.min(block, total - done);
    while (next < timed.length && Math.round((timed[next] as { atSeconds: number }).atSeconds * sampleRate) <= done) {
      host.handle((timed[next] as { command: HostCommand }).command);
      next++;
    }
    host.process(bl, br, n);
    left.set(bl.subarray(0, n), done);
    right.set(br.subarray(0, n), done);
  }
  return { sampleRate, left, right, host };
}
