/**
 * Bouncing a project to audio. Two kinds of bounce, because a producer needs both:
 *
 *  - with a tail: one pass of the loop, then the sound keeps ringing (reverb, delay, 808 release) with nothing
 *    new played, so the file ends the way a song section would;
 *  - seamless: the loop itself, taken from the second of two passes, so the end of the previous pass has already
 *    rung into the start. Dropped into another program on repeat, it has no click and no gap at the seam.
 */
import { STEPS_PER_BAR, type Project } from '@pro-studio/shared';
import { EMPTY_PATTERN } from '../sequencer';
import { renderOffline } from './offline';

export interface LoopRenderOptions {
  sampleRate?: number;
  /** Seconds of ring-out after the loop for the "with a tail" bounce. Default 3. */
  tailSeconds?: number;
  blockSize?: number;
}

export interface LoopRender {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
  /** Frames in one pass of the loop. */
  loopFrames: number;
}

/** Frames in one pass of the project's loop at a sample rate. */
export function loopFramesOf(project: Project, sampleRate: number): number {
  const seconds = (project.bars * STEPS_PER_BAR * 60) / (project.bpm * 4);
  return Math.max(1, Math.round(seconds * sampleRate));
}

const setup = (project: Project) => [{ type: 'setProject', project } as const, { type: 'play' } as const];

export function renderLoopWithTail(project: Project, o: LoopRenderOptions = {}): LoopRender {
  const sampleRate = o.sampleRate ?? 44100;
  const block = Math.max(1, o.blockSize ?? 128);
  const loopFrames = loopFramesOf(project, sampleRate);
  const tailFrames = Math.max(0, Math.round((o.tailSeconds ?? 3) * sampleRate));
  const pass = renderOffline({ sampleRate, seconds: loopFrames / sampleRate, blockSize: block, commands: setup(project) });
  const left = new Float32Array(loopFrames + tailFrames);
  const right = new Float32Array(loopFrames + tailFrames);
  left.set(pass.left.subarray(0, loopFrames));
  right.set(pass.right.subarray(0, loopFrames));

  // From here nothing new is played: an empty pattern lets the voices and effects ring out.
  pass.host.handle({ type: 'setPattern', pattern: EMPTY_PATTERN });
  const bl = new Float32Array(block);
  const br = new Float32Array(block);
  for (let done = 0; done < tailFrames; done += block) {
    const n = Math.min(block, tailFrames - done);
    pass.host.process(bl, br, n);
    left.set(bl.subarray(0, n), loopFrames + done);
    right.set(br.subarray(0, n), loopFrames + done);
  }
  return { sampleRate, left, right, loopFrames };
}

export function renderSeamlessLoop(project: Project, o: LoopRenderOptions = {}): LoopRender {
  const sampleRate = o.sampleRate ?? 44100;
  const loopFrames = loopFramesOf(project, sampleRate);
  const two = renderOffline({ sampleRate, seconds: (2 * loopFrames) / sampleRate, blockSize: o.blockSize, commands: setup(project) });
  return {
    sampleRate,
    left: two.left.slice(loopFrames, 2 * loopFrames),
    right: two.right.slice(loopFrames, 2 * loopFrames),
    loopFrames,
  };
}
