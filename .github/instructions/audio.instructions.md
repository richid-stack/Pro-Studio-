---
applyTo: "packages/engine/**,apps/web/src/audio/**"
---

# Audio code

- Per-block code (worklet `process`, DSP kernels) must not allocate (no `new`, array literals, closures, spread or `.map` in the hot path), lock, log, use `Date`, promises or timers, or throw. Preallocate buffers in the constructor.
- Guard against denormals, NaN and Infinity; the master path must end in a limiter.
- Parameters change through smoothed values, never as a step, to avoid clicks.
- Timing is sample-based and driven from the audio side; the UI only sends commands.
- Every DSP change needs an offline-render test asserting on samples (peak, RMS, frequency, onset timing) with a fixed seed so results are deterministic.
- `packages/engine` may import only `@pro-studio/shared`.
