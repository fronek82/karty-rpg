import type { PoleObraz, Rewers, Szablon } from '../model/szablon';
import { znajdzElement } from '../ozdobniki/katalog';
import { renderujKarte, type KontekstRenderowania, type WyrenderowanaKarta } from './karta';
import { kolorSymbolu, polaczGlify, symboleSceny, type ElementSceny } from './scena';
import type { Wymiary } from './uklad';

/** Wspólna scena tyłu. Wymiary odniesienia definiują położenie i kolejność warstw. */
export function renderujRewers(
  r: Rewers,
  ctx: KontekstRenderowania,
  rozmiar: Wymiary = { szer: r.rozmiar.szerokosc, wys: r.rozmiar.wysokosc },
): WyrenderowanaKarta {
  const { szerokosc: szer, wysokosc: wys } = r.rozmiar;
  const pelnaRamka = { x: 0, y: 0, szer, wys };
  const elementy: ElementSceny[] = [];
  const kawalki: WyrenderowanaKarta[] = [];
  const ostrzezenia: WyrenderowanaKarta['ostrzezenia'] = [];
  const pustyKorzen = { id: r.korzen.id, typ: 'swobodny' as const, dzieci: [] };
  const uklad = {
    ...pustyKorzen,
    ...(r.korzen.padding !== undefined ? { padding: r.korzen.padding } : {}),
  };
  const podstawa: Szablon = { id: r.id, nazwa: r.nazwa, rozmiar: r.rozmiar, korzen: pustyKorzen };
  const rysuj = (s: Szablon) => {
    const wynik = renderujKarte(s, { dane: {} }, ctx);
    kawalki.push(wynik);
    return wynik;
  };
  if (r.tlo) elementy.push({ typ: 'prostokat', ...pelnaRamka, wypelnienie: r.tlo });
  const zasob = r.teksturaTla;
  const dopasowanie = r.dopasowanieTla ?? 'wypelnij';
  if (zasob && dopasowanie === 'kafelki') {
    const info = ctx.obraz?.(zasob);
    if (info?.szerokosc && info.wysokosc) {
      const bok = Math.max(szer, wys) / 8;
      const skala = Math.max(
        bok / Math.max(info.szerokosc, info.wysokosc),
        szer / (32 * info.szerokosc),
        wys / (32 * info.wysokosc),
      );
      const sz = info.szerokosc * skala;
      const wy = info.wysokosc * skala;
      for (let y = 0; y < wys; y += wy)
        for (let x = 0; x < szer; x += sz) {
          elementy.push({ typ: 'obraz', zasob, x, y, szer: sz, wys: wy });
        }
    } else ostrzezenia.push({ pole: r.id, komunikat: 'brak-obrazu', szczegoly: zasob });
  } else if (zasob && dopasowanie !== 'kafelki') {
    const tlo: PoleObraz = {
      id: 'tekstura-rewersu',
      typ: 'obraz',
      zasob,
      dopasowanie,
      szerokosc: { mm: szer },
      wysokosc: { mm: wys },
    };
    elementy.push(
      ...rysuj({ ...podstawa, korzen: { ...pustyKorzen, dzieci: [tlo] } }).scena.elementy,
    );
  }

  elementy.push(...rysuj({ ...podstawa, korzen: { ...r.korzen, dzieci: [] } }).scena.elementy);
  for (const w of r.korzen.dzieci) {
    const wynik = rysuj({ ...podstawa, korzen: { ...uklad, dzieci: [w] } });
    const grafika = Object.hasOwn(r.grafiki ?? {}, w.id) ? r.grafiki?.[w.id] : undefined;
    if (!grafika) {
      elementy.push(...wynik.scena.elementy);
      continue;
    }
    const e = znajdzElement(grafika.element, ctx.elementy);
    const u = wynik.wezly.find(({ id }) => id === w.id);
    if (!e || !u) {
      ostrzezenia.push({
        pole: w.id,
        komunikat: 'nieznany-element-ozdobny',
        szczegoly: grafika.element,
      });
      continue;
    }
    const k = u.lokalne;
    const sx = k.szer / e.szer;
    const sy = k.wys / e.wys;
    const sciezki: ElementSceny[] = e.kontury.map((c) => ({
      typ: 'sciezka',
      kontur: c.kontur,
      ...(c.wypelnienie
        ? {
            wypelnienie: kolorSymbolu(
              e.kolorowanie === 'jednolity' ? 'kolor' : c.wypelnienie,
              grafika.kolor,
            ),
          }
        : {}),
      ...(c.obrys
        ? {
            obrys: {
              ...c.obrys,
              kolor: kolorSymbolu(
                e.kolorowanie === 'jednolity' ? 'kolor' : c.obrys.kolor,
                grafika.kolor,
              ),
            },
          }
        : {}),
      ...(c.evenodd ? { evenodd: true } : {}),
    }));
    elementy.push({
      typ: 'grupa',
      x: k.x + k.szer / 2,
      y: k.y + k.wys / 2,
      ...(u.obrot ? { obrot: u.obrot } : {}),
      macierz: [sx, 0, 0, sy, -k.szer / 2, -k.wys / 2],
      elementy: sciezki,
    });
  }
  if (r.ramka) elementy.push(...rysuj({ ...podstawa, ramka: r.ramka }).scena.elementy);
  return {
    scena: {
      szer: rozmiar.szer,
      wys: rozmiar.wys,
      elementy: [
        {
          typ: 'grupa',
          x: 0,
          y: 0,
          macierz: [rozmiar.szer / szer, 0, 0, rozmiar.wys / wys, 0, 0],
          przyciecie: { x: 0, y: 0, ...rozmiar },
          elementy,
        },
      ],
      glify: polaczGlify(...kawalki.map((k) => k.scena.glify)),
      ...symboleSceny(...kawalki.map((k) => k.scena.symbole)),
    },
    ostrzezenia: [...ostrzezenia, ...kawalki.flatMap((k) => k.ostrzezenia)],
    wezly: kawalki.flatMap((k) => k.wezly.filter((w) => w.id !== r.korzen.id)),
  };
}
