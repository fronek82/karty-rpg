/** Deterministyczny zapis liczby: zaokrąglenie do `miejsc` miejsc po przecinku, bez zbędnych zer. */
export function liczba(v: number, miejsc = 3): string {
  const p = 10 ** miejsc;
  const r = Math.round(v * p) / p;
  return Object.is(r, -0) ? '0' : String(r);
}
