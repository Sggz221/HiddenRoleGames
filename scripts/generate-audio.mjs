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

/** Two low thumps (lub-dub) per beat: the last seconds of a phase. */
function heartbeat() {
  const rate = 11025;
  return wav(
    make(0.9, rate, (t) => {
      const thump = (start, f, gain) => {
        const local = t - start;
        return local < 0 ? 0 : Math.sin(TAU * f * local) * Math.exp(-local * 22) * gain;
      };
      return thump(0, 52, 0.9) + thump(0.22, 46, 0.6);
    }),
    rate,
  );
}

/** A dry clock tick for the final countdown. */
function tick() {
  const rate = 22050;
  const noise = lcg(3);
  return wav(
    make(0.08, rate, (t) => (noise() * 0.5 + Math.sin(TAU * 2400 * t)) * Math.exp(-t * 90) * 0.35),
    rate,
  );
}

/** A distant church bell: inharmonic partials with a long decay. */
function bell() {
  const rate = 22050;
  const partials = [
    [110, 0.5],
    [220, 0.3],
    [264, 0.22],
    [331, 0.16],
    [440, 0.1],
    [587, 0.06],
  ];
  return wav(
    make(3.2, rate, (t) => {
      const strike = Math.min(1, t * 400);
      return (
        partials.reduce(
          (sum, [f, gain], i) =>
            sum + Math.sin(TAU * f * t) * gain * Math.exp(-t * (1.1 + i * 0.35)),
          0,
        ) *
        strike *
        0.6
      );
    }),
    rate,
  );
}

/** A low snarl that wakes the pack: filtered noise over a growling square-ish tone. */
function growl() {
  const rate = 22050;
  const noise = lcg(11);
  let lp = 0;
  return wav(
    make(1.6, rate, (t) => {
      const env = Math.sin((Math.PI * t) / 1.6) ** 1.5;
      lp += 0.08 * (noise() - lp);
      const rumble = Math.sign(Math.sin(TAU * (70 + 8 * Math.sin(TAU * 7 * t)) * t)) * 0.25;
      return (rumble + lp * 3) * env * 0.5;
    }),
    rate,
  );
}

/** Paper whoosh plus a snap: the role card turning over. */
function cardFlip() {
  const rate = 22050;
  const noise = lcg(5);
  let hp = 0;
  let last = 0;
  return wav(
    make(0.35, rate, (t) => {
      const n = noise();
      hp = 0.9 * (hp + n - last);
      last = n;
      const whoosh = hp * Math.sin((Math.PI * Math.min(t, 0.25)) / 0.25) * 0.25;
      const snap =
        t > 0.24 ? Math.sin(TAU * 1800 * (t - 0.24)) * Math.exp(-(t - 0.24) * 60) * 0.4 : 0;
      return whoosh + snap;
    }),
    rate,
  );
}

/** Rising major arpeggio: your side won. */
function stingerWin() {
  const rate = 22050;
  const notes = [392, 494, 587, 784, 988];
  return wav(
    make(2.6, rate, (t) =>
      notes.reduce((sum, f, i) => {
        const local = t - i * 0.12;
        return local < 0
          ? sum
          : sum +
              (Math.sin(TAU * f * local) + 0.3 * Math.sin(TAU * 2 * f * local)) *
                Math.exp(-local * 1.6) *
                0.12;
      }, 0),
    ),
    rate,
  );
}

/** Falling minor line over a low drone: your side lost. */
function stingerLose() {
  const rate = 22050;
  const notes = [440, 415, 349, 294];
  return wav(
    make(3, rate, (t) => {
      const drone = Math.sin(TAU * 73.4 * t) * 0.15 * Math.exp(-t * 0.6);
      return notes.reduce((sum, f, i) => {
        const local = t - i * 0.32;
        return local < 0 ? sum : sum + Math.sin(TAU * f * local) * Math.exp(-local * 2) * 0.16;
      }, drone);
    }),
    rate,
  );
}

/** Soft airy swoosh for panels opening (rising) and closing (falling). */
function swoosh(rising) {
  const rate = 22050;
  const noise = lcg(rising ? 13 : 17);
  let lp = 0;
  return wav(
    make(0.28, rate, (t) => {
      const k = rising ? 0.05 + t * 0.6 : 0.22 - t * 0.6;
      lp += Math.max(0.02, k) * (noise() - lp);
      return lp * Math.sin((Math.PI * t) / 0.28) * 0.9;
    }),
    rate,
  );
}

/** A short wooden knock: picking a target. */
function select() {
  const rate = 22050;
  return wav(
    make(
      0.12,
      rate,
      (t) => (Math.sin(TAU * 520 * t) + 0.5 * Math.sin(TAU * 1310 * t)) * Math.exp(-t * 45) * 0.4,
    ),
    rate,
  );
}

/** Two quick soft notes: a chat line arrived. */
function chatPop() {
  const rate = 22050;
  return wav(
    make(0.25, rate, (t) => {
      const note = (start, f) => {
        const local = t - start;
        return local < 0 ? 0 : Math.sin(TAU * f * local) * Math.exp(-local * 30) * 0.3;
      };
      return note(0, 880) + note(0.07, 1175);
    }),
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
  heartbeat: heartbeat(),
  tick: tick(),
  bell: bell(),
  growl: growl(),
  "card-flip": cardFlip(),
  "stinger-win": stingerWin(),
  "stinger-lose": stingerLose(),
  "ui-open": swoosh(true),
  "ui-close": swoosh(false),
  select: select(),
  "chat-pop": chatPop(),
};
for (const [name, buffer] of Object.entries(files)) {
  writeFileSync(join(OUT, `${name}.wav`), buffer);
  console.log(`${name}.wav  ${(buffer.length / 1024).toFixed(0)} KB`);
}
