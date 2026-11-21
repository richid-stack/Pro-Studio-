/**
 * The audio thread. A thin shell: everything it does lives in EngineHost (packages/engine), which is the same
 * code the tests and server renders run. Commands come in over the port, telemetry goes back out.
 */
import { EngineHost, type HostCommand } from '@pro-studio/engine';

// AudioWorkletGlobalScope: not in the DOM typings.
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;

class ProStudioProcessor extends AudioWorkletProcessor {
  private readonly host = new EngineHost(sampleRate);

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<HostCommand>) => this.host.handle(e.data);
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    const left = out?.[0];
    if (!out || !left) return true;
    this.host.process(left, out[1] ?? left, left.length);
    const t = this.host.takeTelemetry();
    if (t.length > 0) this.port.postMessage(t);
    return true;
  }
}

registerProcessor('pro-studio-engine', ProStudioProcessor);
