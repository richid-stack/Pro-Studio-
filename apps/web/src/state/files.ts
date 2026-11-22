/** Saving, opening and exporting. The browser's download and file-picker plumbing lives here; the rules (what a valid project is, how audio is rendered) live in the packages. */
import { parseProjectJson, type Project } from '@pro-studio/shared';
import type { WavFormat } from '@pro-studio/engine';
import type { ExportRequest, ExportResponse } from '../audio/export.worker';
import { studio } from './studio';
import { uiState } from './ui';

export const fileSafeName = (name: string): string => name.trim().replace(/[^\p{L}\p{N}._ -]+/gu, '').replace(/\s+/g, '-').slice(0, 60) || 'beat';

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function saveProjectFile(project: Project = studio.get()): void {
  download(`${fileSafeName(project.name)}.prostudio.json`, new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
  uiState.announce(`Saved ${project.name} to your downloads.`);
}

/** Pick a file and open it as a project. Undo brings the previous project back. */
export function openProjectFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const r = parseProjectJson(await file.text());
    if (r.ok) {
      studio.replace(r.project);
      uiState.selectChannel(null);
      uiState.announce(`Opened ${r.project.name}. Undo brings your previous project back.`);
    } else {
      uiState.announce(`Could not open ${file.name}: ${r.error}`);
    }
  });
  input.click();
}

export interface ExportOptions {
  kind: ExportRequest['kind'];
  format: WavFormat;
  sampleRate: number;
}

let exporting = false;

/** Render the project in a worker and download the WAV. Resolves with an error message, or null on success. */
export function exportWav(opts: ExportOptions, project: Project = studio.get()): Promise<string | null> {
  if (exporting) return Promise.resolve('An export is already running.');
  exporting = true;
  return new Promise((resolve) => {
    const worker = new Worker(new URL('../audio/export.worker.ts', import.meta.url), { type: 'module' });
    const done = (message: string | null): void => {
      exporting = false;
      worker.terminate();
      resolve(message);
    };
    worker.onmessage = (e: MessageEvent<ExportResponse>) => {
      if (e.data.ok) {
        const suffix = opts.kind === 'loop' ? 'loop' : 'with-tail';
        download(`${fileSafeName(project.name)}-${suffix}.wav`, new Blob([e.data.bytes.buffer as ArrayBuffer], { type: 'audio/wav' }));
        uiState.announce(`Exported ${project.name} as a WAV file.`);
        done(null);
      } else {
        done(e.data.error);
      }
    };
    worker.onerror = () => done('The export could not start in this browser.');
    const req: ExportRequest = { project, ...opts };
    worker.postMessage(req);
  });
}
