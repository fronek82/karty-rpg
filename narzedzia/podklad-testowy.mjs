// Generuje testowy podkład ze wzoru karty (252 × 352 px = 63 × 88 mm po 4 px/mm) – deterministycznie,
// bez zależności: ilustracja w górnej części, pasek tytułu, koło w rogu, pionowy napis i ramka opisu.
// Użycie: node narzedzia/podklad-testowy.mjs [plik-wyjściowy]
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SZER = 252;
const WYS = 352;
const T = 4; // px na mm
const KREM = [244, 236, 216];
const ZIEL = [122, 144, 112];
const GRAN = [44, 62, 80];
const ZLOTO = [184, 134, 11];
const BRAZ = [91, 58, 30];

const wProst = (x, y, mmX, mmY, mmS, mmW) =>
  x >= mmX * T && x < (mmX + mmS) * T && y >= mmY * T && y < (mmY + mmW) * T;

const piksel = (x, y) => {
  // Koło wartości w lewym górnym rogu (środek 9 × 9 mm, promień 6 mm).
  if (Math.hypot(x + 0.5 - 9 * T, y + 0.5 - 9 * T) < 6 * T) return ZLOTO;
  // Pasek tytułu nałożony na ilustrację.
  if (wProst(x, y, 6, 34, 51, 12)) return GRAN;
  // Pionowy napis przy prawej krawędzi (cienki pasek).
  if (wProst(x, y, 57, 8, 3, 40)) return BRAZ;
  // Ilustracja w tle (do 46 mm).
  if (y < 46 * T) return ZIEL;
  // Ramka opisu.
  if (wProst(x, y, 4, 50, 55, 30) && !wProst(x, y, 4.5, 50.5, 54, 29)) return BRAZ;
  return KREM;
};

const surowe = Buffer.alloc((SZER * 4 + 1) * WYS);
for (let y = 0; y < WYS; y++) {
  surowe[y * (SZER * 4 + 1)] = 0;
  for (let x = 0; x < SZER; x++) {
    const [r, g, b] = piksel(x, y);
    surowe.set([r, g, b, 255], y * (SZER * 4 + 1) + 1 + x * 4);
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
naglowek.writeUInt32BE(SZER, 0);
naglowek.writeUInt32BE(WYS, 4);
naglowek.set([8, 6, 0, 0, 0], 8);
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  kawalek('IHDR', naglowek),
  kawalek('IDAT', deflateSync(surowe, { level: 9 })),
  kawalek('IEND', Buffer.alloc(0)),
]);
writeFileSync(process.argv[2] ?? 'testy/zasoby/podklad-testowy.png', png);
