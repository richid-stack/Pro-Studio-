/**
 * Bounces a project to a WAV file off the main thread, so the screen stays responsive while a long loop renders.
 * It runs the same engine the speakers use, so what you export is what you heard.
 */
import { encodeWav, renderLoopWithTail, renderSeamlessLoop, type WavFormat } from '@pro-studio/engine';
import type { Project } from '@pro-studio/shared';

export interface ExportRequest {
  project: Project;
  kind: 'loop' | 'tail';
  format: WavFormat;
  sampleRate: number;
}

export type ExportResponse = { ok: true; bytes: Uint8Array } | { ok: false; error: string };

interface WorkerScope {
  onmessage: ((e: MessageEvent<ExportRequest>) => void) | null;
  postMessage(message: ExportResponse, transfer?: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;

scope.onmessage = (e) => {
  try {
    const { project, kind, format, sampleRate } = e.data;
    const r = kind === 'loop' ? renderSeamlessLoop(project, { sampleRate }) : renderLoopWithTail(project, { sampleRate });
    const bytes = encodeWav([r.left, r.right], r.sampleRate, format);
    scope.postMessage({ ok: true, bytes }, [bytes.buffer]);
  } catch (err) {
    scope.postMessage({ ok: false, error: err instanceof Error ? err.message : 'The export failed.' });
  }
};
