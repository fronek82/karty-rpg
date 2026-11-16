/** Pobranie pliku przez przeglądarkę (link z `download`). */
export function zapiszPlik(bajty: Uint8Array, typ: string, nazwa: string): void {
  const url = URL.createObjectURL(new Blob([bajty as Uint8Array<ArrayBuffer>], { type: typ }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nazwa;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Bezpieczna nazwa pliku z nazwy wyświetlanej. */
export function nazwaPliku(nazwa: string, rozszerzenie: string): string {
  const baza = nazwa
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[łŁ]/g, 'l')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${baza || 'projekt'}${rozszerzenie}`;
}
