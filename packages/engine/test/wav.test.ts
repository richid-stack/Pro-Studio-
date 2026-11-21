import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeWav, encodeWav, type WavFormat } from '../src/index';
import { SR, noise, sine } from './synth';

describe('WAV', () => {
  const left = sine(440, 0.2, SR, 0.8);
  const right = noise(0.2, 3);

  for (const [format, tolerance] of [['pcm16', 1 / 32767], ['pcm24', 1 / 8388607], ['float32', 0]] as const satisfies ReadonlyArray<readonly [WavFormat, number]>) {
    it(`${format} round-trips to within one quantisation step`, () => {
      const bytes = encodeWav([left, right], SR, format);
      const back = decodeWav(bytes);
      assert.equal(back.sampleRate, SR);
      assert.equal(back.channels.length, 2);
      assert.equal((back.channels[0] as Float32Array).length, left.length);
      let worst = 0;
      back.channels.forEach((ch, c) => ch.forEach((x, i) => { worst = Math.max(worst, Math.abs(x - ((c === 0 ? left : right)[i] as number))); }));
      assert.ok(worst <= tolerance + 1e-7, `${format} worst error ${worst}`);
    });
  }

  it('writes a correct header', () => {
    const b = encodeWav([left], 48000, 'pcm16');
    const v = new DataView(b.buffer);
    assert.equal(String.fromCharCode(...b.slice(0, 4)), 'RIFF');
    assert.equal(String.fromCharCode(...b.slice(8, 12)), 'WAVE');
    assert.equal(v.getUint32(4, true), b.length - 8);
    assert.equal(v.getUint16(22, true), 1);
    assert.equal(v.getUint32(24, true), 48000);
    assert.equal(v.getUint32(28, true), 48000 * 2);
    assert.equal(v.getUint32(40, true), left.length * 2);
    assert.equal(b.length, 44 + left.length * 2);
  });

  it('clips out-of-range samples instead of wrapping them', () => {
    const back = decodeWav(encodeWav([Float32Array.from([2, -2, 0.5])], SR, 'pcm16'));
    assert.deepEqual([...(back.channels[0] as Float32Array)].map((x) => Math.round(x * 100) / 100), [1, -1, 0.5]);
  });

  it('handles empty audio and rejects files that are not WAV', () => {
    assert.equal((decodeWav(encodeWav([new Float32Array(0)], SR)).channels[0] as Float32Array).length, 0);
    assert.throws(() => decodeWav(new Uint8Array(100)), /not a WAV/);
    assert.throws(() => decodeWav(Uint8Array.from([...'RIFF\0\0\0\0WAVE'].map((c) => c.charCodeAt(0)))), /no data/);
  });
});
