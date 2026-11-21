import { audioHost } from '../audio/audioHost';
import { createStore, useStore } from './store';

/** Play state the UI shows. Optimistic: the button flips at once; the engine's own report corrects it. */
const state = createStore({ playing: false, recording: false });

audioHost.subscribeTelemetry(() => {
  const real = audioHost.getTransport().playing;
  state.set((s) => (s.playing === real ? s : { ...s, playing: real }));
});

export const transport = {
  store: state,
  play(): void {
    state.set((s) => ({ ...s, playing: true }));
    void audioHost.sendFromGesture({ type: 'play' });
  },
  pause(): void {
    state.set((s) => ({ ...s, playing: false }));
    audioHost.send({ type: 'pause' });
  },
  stop(): void {
    state.set((s) => ({ ...s, playing: false }));
    audioHost.send({ type: 'stop' });
  },
  toggle(): void {
    if (state.get().playing) this.pause();
    else this.play();
  },
  seek(tick: number): void {
    audioHost.send({ type: 'seek', tick });
  },
};

export const usePlaying = (): boolean => useStore(state, (s) => s.playing);
