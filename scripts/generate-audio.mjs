// Synthesises the game's original ambience and effects (no third-party samples).
// Usage: node scripts/generate-audio.mjs  → writes apps/web/public/audio/*.wav
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dirname, "..", "apps", "web", "public", "audio");
const TAU = Math.PI * 2;

/** Deterministic noise so regenerated files are byte-identical. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x80000000 - 1;
  };
}

function wav(samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2);
  });
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const make = (seconds, rate, fn) =>
  Array.from({ length: Math.floor(seconds * rate) }, (_, i) => fn(i / rate, i));

/** Frequencies are integer multiples of 1/seconds so loops close without a click. */
function night() {
  const rate = 11025;
  const seconds = 8;
  const noise = lcg(1);
  let lp = 0;
  return wav(
    make(seconds, rate, (t) => {
      lp += 0.02 * (noise() - lp); // soft wind
      const swell = 0.5 + 0.5 * Math.sin((TAU * t) / seconds);
      const drone = Math.sin(TAU * 55 * t) * 0.3 + Math.sin(TAU * 82.5 * t) * 0.15;
      return (drone + lp * 2.2 * swell) * 0.55;
    }),
    rate,
  );
}

function day() {
  const rate = 11025;
  const seconds = 8;
  return wav(
    make(seconds, rate, (t) => {
      const chord = [261, 329, 392].map((f, i) => Math.sin(TAU * f * t + i) * 0.12);
      const tremolo = 0.75 + 0.25 * Math.sin((TAU * 2 * t) / seconds);
      return chord.reduce((a, b) => a + b, 0) * tremolo;
    }),
    rate,
  );
}

function vote() {
  const rate = 11025;
  const seconds = 4;
  return wav(
    make(seconds, rate, (t) => {
      const beat = t % 1;
      const thump = Math.sin(TAU * 60 * t) * Math.exp(-beat * 9);
      return thump * 0.5 + Math.sin(TAU * 110 * t) * 0.08;
    }),
    rate,
  );
}

function howl() {
  const rate = 22050;
  return wav(
    make(2.6, rate, (t) => {
      const env = Math.sin((Math.PI * t) / 2.6) ** 2;
      // Integrated frequency glide 300 → 560 → 300 Hz.
      const phase = 300 * t + (260 * 2.6 * (1 - Math.cos((Math.PI * t) / 2.6))) / Math.PI;
      return (Math.sin(TAU * phase) + 0.4 * Math.sin(TAU * 2 * phase)) * env * 0.35;
    }),
    rate,
  );
}

function death() {
  const rate = 22050;
  const noise = lcg(7);
  return wav(
    make(1.2, rate, (t) => {
      const env = Math.exp(-t * 5);
      return (Math.sin(TAU * (90 - 40 * t) * t) * 0.8 + noise() * 0.15) * env * 0.7;
    }),
    rate,
  );
}

function dawn() {
  const rate = 22050;
  return wav(
    make(2.4, rate, (t) => {
      const notes = [523, 659, 784, 1047];
      return notes.reduce((sum, f, i) => {
        const local = t - i * 0.25;
        return local < 0 ? sum : sum + Math.sin(TAU * f * local) * Math.exp(-local * 2.2) * 0.18;
      }, 0);
    }),
    rate,
  );
}

function voteCast() {
  const rate = 22050;
  return wav(
    make(0.18, rate, (t) => Math.sin(TAU * 700 * t) * Math.exp(-t * 28) * 0.5),
    rate,
  );
}

mkdirSync(OUT, { recursive: true });
const files = {
  "ambient-night": night(),
  "ambient-day": day(),
  "ambient-vote": vote(),
  howl: howl(),
  death: death(),
  dawn: dawn(),
  "vote-cast": voteCast(),
};
for (const [name, buffer] of Object.entries(files)) {
  writeFileSync(join(OUT, `${name}.wav`), buffer);
  console.log(`${name}.wav  ${(buffer.length / 1024).toFixed(0)} KB`);
}
