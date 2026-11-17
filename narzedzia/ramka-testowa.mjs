// Generuje testowy PNG ramki 9-slice (120 × 120 px, wcięcia 30 px) – deterministycznie, bez zależności.
// Użycie: node narzedzia/ramka-testowa.mjs [plik-wyjściowy]
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const N = 120;
const W = 30;
const BRAZ = [91, 58, 30];
const CZERW = [122, 46, 36];
const KREM = [233, 217, 174];
const SRODEK = [247, 240, 220];

const piksel = (x, y) => {
  const d = Math.min(x, y, N - 1 - x, N - 1 - y);
  if (d < 4) return BRAZ;
  if (d >= W - 2 && d < W) return BRAZ;
  if (d >= W) return SRODEK;
  // Narożnik: czerwone koło z ciemnym pierścieniem.
  if (
    (x < W && y < W) ||
    (x >= N - W && y < W) ||
    (x < W && y >= N - W) ||
    (x >= N - W && y >= N - W)
  ) {
    const cx = x < W ? W / 2 : N - W / 2;
    const cy = y < W ? W / 2 : N - W / 2;
    const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (r < 9) return CZERW;
    if (r < 11) return BRAZ;
    return KREM;
  }
  // Bok: romby co 15 px wzdłuż boku.
  const poz = x < W || x >= N - W ? y : x;
  const dx = Math.abs((poz % 15) - 7);
  const dy = Math.abs(d - 15);
  return dx + dy < 5 ? CZERW : KREM;
};

const surowe = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) {
  surowe[y * (N * 4 + 1)] = 0;
  for (let x = 0; x < N; x++) {
    const [r, g, b] = piksel(x, y);
    surowe.set([r, g, b, 255], y * (N * 4 + 1) + 1 + x * 4);
  }
}

const tabelaCrc = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = tabelaCrc[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const kawalek = (typ, dane) => {
  const t = Buffer.concat([Buffer.from(typ, 'latin1'), dane]);
  const d = Buffer.alloc(4);
  d.writeUInt32BE(dane.length);
  const s = Buffer.alloc(4);
  s.writeUInt32BE(crc(t));
  return Buffer.concat([d, t, s]);
};
const naglowek = Buffer.alloc(13);
naglowek.writeUInt32BE(N, 0);
naglowek.writeUInt32BE(N, 4);
naglowek.set([8, 6, 0, 0, 0], 8);
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  kawalek('IHDR', naglowek),
  kawalek('IDAT', deflateSync(surowe, { level: 9 })),
  kawalek('IEND', Buffer.alloc(0)),
]);
writeFileSync(process.argv[2] ?? 'testy/zasoby/ramka-testowa.png', png);
