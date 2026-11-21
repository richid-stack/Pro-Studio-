/** WAV encoding and decoding: 16-bit and 24-bit PCM, and 32-bit float. Used by export, tests and server renders. */
export type WavFormat = 'pcm16' | 'pcm24' | 'float32';

export interface DecodedWav {
  sampleRate: number;
  channels: Float32Array[];
}

export function encodeWav(channels: readonly Float32Array[], sampleRate: number, format: WavFormat = 'pcm16'): Uint8Array {
  const nch = channels.length;
  const frames = nch === 0 ? 0 : (channels[0] as Float32Array).length;
  const bytes = format === 'pcm16' ? 2 : format === 'pcm24' ? 3 : 4;
  const dataSize = frames * nch * bytes;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const str = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, format === 'float32' ? 3 : 1, true);
  v.setUint16(22, nch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * nch * bytes, true);
  v.setUint16(32, nch * bytes, true);
  v.setUint16(34, bytes * 8, true);
  str(36, 'data');
  v.setUint32(40, dataSize, true);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < nch; c++) {
      const x = (channels[c] as Float32Array)[i] as number;
      if (format === 'float32') {
        v.setFloat32(o, x, true);
      } else if (format === 'pcm16') {
        v.setInt16(o, Math.round(Math.max(-1, Math.min(1, x)) * 32767), true);
      } else {
        const n = Math.round(Math.max(-1, Math.min(1, x)) * 8388607);
        v.setUint8(o, n & 0xff);
        v.setUint8(o + 1, (n >> 8) & 0xff);
        v.setUint8(o + 2, (n >> 16) & 0xff);
      }
      o += bytes;
    }
  }
  return new Uint8Array(buf);
}

export function decodeWav(data: Uint8Array): DecodedWav {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tag = (o: number): string => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
  let o = 12;
  let fmt: { code: number; nch: number; sr: number; bits: number } | null = null;
  while (o + 8 <= data.byteLength) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    if (id === 'fmt ') {
      fmt = { code: v.getUint16(o + 8, true), nch: v.getUint16(o + 10, true), sr: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
    } else if (id === 'data') {
      if (!fmt) throw new Error('WAV data before fmt chunk');
      const bytes = fmt.bits / 8;
      const frames = Math.floor(size / (bytes * fmt.nch));
      const channels = Array.from({ length: fmt.nch }, () => new Float32Array(frames));
      let p = o + 8;
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < fmt.nch; c++) {
          let x: number;
          if (fmt.code === 3 && fmt.bits === 32) x = v.getFloat32(p, true);
          else if (fmt.code === 1 && fmt.bits === 16) x = v.getInt16(p, true) / 32767;
          else if (fmt.code === 1 && fmt.bits === 24) x = (((v.getUint8(p + 2) << 24) | (v.getUint8(p + 1) << 16) | (v.getUint8(p) << 8)) >> 8) / 8388607;
          else throw new Error(`unsupported WAV format ${fmt.code}/${fmt.bits}`);
          (channels[c] as Float32Array)[i] = x;
          p += bytes;
        }
      }
      return { sampleRate: fmt.sr, channels };
    }
    o += 8 + size + (size % 2);
  }
  throw new Error('WAV has no data chunk');
}
