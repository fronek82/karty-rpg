import {
  PDFDocument,
  PDFName,
  PDFOperator,
  PDFRef,
  type PDFPage,
  appendBezierCurve,
  clip,
  closePath,
  concatTransformationMatrix,
  drawObject,
  endPath,
  fill,
  fillAndStroke,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setDashPattern,
  setFillingRgbColor,
  setLineJoin,
  setLineWidth,
  setStrokingRgbColor,
  LineJoinStyle,
  stroke,
} from 'pdf-lib';
import { PT_NA_MM } from '../model/jednostki';
import type { Kolor } from '../model/szablon';
import {
  czyObrys,
  kolorSceny,
  type ElementSceny,
  type Kontur,
  type Obrys,
  type Scena,
} from '../silnik/scena';

/**
 * Serializator sceny do PDF (pdf-lib). Każda scena = jedna strona o wymiarach sceny.
 * Tekst jako krzywe: każdy glif zapisany w dokumencie RAZ jako Form XObject
 * i wstawiany operatorem `Do` – PDF nie puchnie przy dużej ilości tekstu.
 */

export interface ObrazDoPdf {
  dane: Uint8Array;
  format: 'png' | 'jpg';
}

export interface OpcjePdf {
  obraz?: (zasob: string) => ObrazDoPdf | undefined;
  tytul?: string;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

function kolorRgb(k: Kolor): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(kolorSceny(k));
  if (!m) return [0, 0, 0];
  return [parseInt(m[1]!, 16) / 255, parseInt(m[2]!, 16) / 255, parseInt(m[3]!, 16) / 255].map(
    (v) => Math.round(v * 1000) / 1000,
  ) as [number, number, number];
}

function operatorySciezki(kontur: Kontur, zaokr: (v: number) => number = r3): PDFOperator[] {
  const ops: PDFOperator[] = [];
  for (const k of kontur) {
    switch (k[0]) {
      case 'M':
        ops.push(moveTo(zaokr(k[1]), zaokr(k[2])));
        break;
      case 'L':
        ops.push(lineTo(zaokr(k[1]), zaokr(k[2])));
        break;
      case 'C':
        ops.push(
          appendBezierCurve(
            zaokr(k[1]),
            zaokr(k[2]),
            zaokr(k[3]),
            zaokr(k[4]),
            zaokr(k[5]),
            zaokr(k[6]),
          ),
        );
        break;
      case 'Z':
        ops.push(closePath());
        break;
    }
  }
  return ops;
}

const KAPPA = 0.5522847498;

/** Prostokąt z zaokrąglonymi rogami jako kontur (mm, oś Y w dół). */
export function konturProstokata(x: number, y: number, w: number, h: number, r = 0): Kontur {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr === 0) return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
  const k = rr * KAPPA;
  return [
    ['M', x + rr, y],
    ['L', x + w - rr, y],
    ['C', x + w - rr + k, y, x + w, y + rr - k, x + w, y + rr],
    ['L', x + w, y + h - rr],
    ['C', x + w, y + h - rr + k, x + w - rr + k, y + h, x + w - rr, y + h],
    ['L', x + rr, y + h],
    ['C', x + rr - k, y + h, x, y + h - rr + k, x, y + h - rr],
    ['L', x, y + rr],
    ['C', x, y + rr - k, x + rr - k, y, x + rr, y],
    ['Z'],
  ];
}

export function konturOkregu(cx: number, cy: number, r: number): Kontur {
  const k = r * KAPPA;
  return [
    ['M', cx + r, cy],
    ['C', cx + r, cy + k, cx + k, cy + r, cx, cy + r],
    ['C', cx - k, cy + r, cx - r, cy + k, cx - r, cy],
    ['C', cx - r, cy - k, cx - k, cy - r, cx, cy - r],
    ['C', cx + k, cy - r, cx + r, cy - k, cx + r, cy],
    ['Z'],
  ];
}

function ustawObrys(o: Obrys): PDFOperator[] {
  const [r, g, b] = kolorRgb(o.kolor);
  return [
    setStrokingRgbColor(r, g, b),
    setLineWidth(r3(o.grubosc)),
    setDashPattern(o.kreska ? o.kreska.map(r3) : [], o.kreska ? r3(o.fazaKreski ?? 0) : 0),
  ];
}

function rysujKsztalt(
  kontur: Kontur,
  wyp: Kolor | undefined,
  obrys: Obrys | undefined,
): PDFOperator[] {
  const o = czyObrys(obrys) ? obrys : undefined;
  if (!wyp && !o) return [];
  const ops: PDFOperator[] = [pushGraphicsState()];
  if (wyp) {
    const [r, g, b] = kolorRgb(wyp);
    ops.push(setFillingRgbColor(r, g, b));
  }
  if (o) ops.push(...ustawObrys(o));
  ops.push(...operatorySciezki(kontur));
  ops.push(wyp && o ? fillAndStroke() : wyp ? fill() : stroke());
  ops.push(popGraphicsState());
  return ops;
}

class BudowniczyPdf {
  /** Glif → referencja do XObject (wspólna dla wszystkich stron). */
  private readonly glifyXObject = new Map<string, PDFRef>();
  private readonly obrazy = new Map<string, PDFRef>();
  private licznikGlifow = 0;
  readonly pominieteObrazy = new Set<string>();

  constructor(
    private readonly doc: PDFDocument,
    private readonly opcje: OpcjePdf,
  ) {}

  /**
   * XObject glifu. Wariant `obwodka` wypełnia i obrysowuje kontur (grubość linii i kolor
   * dziedziczy z miejsca wstawienia) – używany pod literami jako obwódka.
   */
  private refGlifu(scena: Scena, klucz: string, obwodka = false): PDFRef {
    const kluczXObject = obwodka ? `${klucz}|obwodka` : klucz;
    const istniejacy = this.glifyXObject.get(kluczXObject);
    if (istniejacy) return istniejacy;
    const kontur = scena.glify[klucz]?.kontur ?? [];
    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;
    for (const k of kontur) {
      for (let i = 1; i < k.length; i += 2) {
        const x = k[i] as number;
        const y = k[i + 1] as number;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    // Kontur w jednostkach czcionki (całkowite po zaokrągleniu do 0,01) – bez koloru:
    // XObject dziedziczy kolor wypełnienia z miejsca wstawienia.
    const ops =
      kontur.length > 0
        ? [
            ...operatorySciezki(kontur, (v) => Math.round(v * 100) / 100),
            obwodka ? fillAndStroke() : fill(),
          ]
        : [];
    // BBox przycina rysunek – przy obwódce poszerzony z zapasem (grubość zależy od wstawienia).
    const zapas = obwodka ? 2000 : 0;
    const strumien = this.doc.context.formXObject(ops, {
      BBox: [
        Math.floor(minX) - zapas,
        Math.floor(minY) - zapas,
        Math.ceil(maxX) + zapas,
        Math.ceil(maxY) + zapas,
      ],
    });
    const ref = this.doc.context.register(strumien);
    this.glifyXObject.set(kluczXObject, ref);
    if (!obwodka) this.licznikGlifow++;
    return ref;
  }

  get liczbaGlifow(): number {
    return this.licznikGlifow;
  }

  private async refObrazu(zasob: string): Promise<PDFRef | undefined> {
    const istniejacy = this.obrazy.get(zasob);
    if (istniejacy) return istniejacy;
    const dane = this.opcje.obraz?.(zasob);
    if (!dane) return undefined;
    try {
      const obraz =
        dane.format === 'png'
          ? await this.doc.embedPng(dane.dane)
          : await this.doc.embedJpg(dane.dane);
      this.obrazy.set(zasob, obraz.ref);
      return obraz.ref;
    } catch {
      // Uszkodzony plik nie przerywa całego PDF – obraz pomijamy i zgłaszamy.
      this.pominieteObrazy.add(zasob);
      return undefined;
    }
  }

  async strona(scena: Scena): Promise<void> {
    const strona = this.doc.addPage([scena.szer * PT_NA_MM, scena.wys * PT_NA_MM]);
    const nazwy = new Map<string, PDFName>();
    const nazwa = (klucz: string, ref: PDFRef, przedrostek: string) => {
      let n = nazwy.get(klucz);
      if (!n) {
        n = strona.node.newXObject(przedrostek, ref);
        nazwy.set(klucz, n);
      }
      return n;
    };
    // Układ współrzędnych strony: mm, oś Y w dół, początek w lewym górnym rogu.
    const ops: PDFOperator[] = [
      pushGraphicsState(),
      concatTransformationMatrix(PT_NA_MM, 0, 0, -PT_NA_MM, 0, scena.wys * PT_NA_MM),
    ];
    for (const e of scena.elementy) ops.push(...(await this.element(scena, e, strona, nazwa)));
    ops.push(popGraphicsState());
    strona.pushOperators(...ops);
  }

  private async element(
    scena: Scena,
    e: ElementSceny,
    strona: PDFPage,
    nazwa: (klucz: string, ref: PDFRef, przedrostek: string) => PDFName,
  ): Promise<PDFOperator[]> {
    switch (e.typ) {
      case 'prostokat':
        return rysujKsztalt(
          konturProstokata(e.x, e.y, e.szer, e.wys, e.promien),
          e.wypelnienie,
          e.obrys,
        );
      case 'okrag':
        return rysujKsztalt(konturOkregu(e.cx, e.cy, e.r), e.wypelnienie, e.obrys);
      case 'sciezka':
        return rysujKsztalt(e.kontur, e.wypelnienie, e.obrys);
      case 'linia':
        if (!czyObrys(e.obrys)) return [];
        return [
          pushGraphicsState(),
          ...ustawObrys(e.obrys),
          moveTo(r3(e.x1), r3(e.y1)),
          lineTo(r3(e.x2), r3(e.y2)),
          stroke(),
          popGraphicsState(),
        ];
      case 'tekst': {
        const [r, g, b] = kolorRgb(e.kolor);
        const ops: PDFOperator[] = [];
        if (e.obwodka && e.obwodka.grubosc > 0) {
          const [or, og, ob] = kolorRgb(e.obwodka.kolor);
          ops.push(
            pushGraphicsState(),
            setFillingRgbColor(or, og, ob),
            setStrokingRgbColor(or, og, ob),
            setLineJoin(LineJoinStyle.Round),
          );
          for (const gl of e.glify) {
            const n = nazwa(`${gl.klucz}|obwodka`, this.refGlifu(scena, gl.klucz, true), 'O');
            const s = Math.round(gl.skala * 1e6) / 1e6;
            ops.push(
              pushGraphicsState(),
              concatTransformationMatrix(s, 0, 0, -s, r3(gl.x), r3(gl.y)),
              // Grubość w jednostkach glifu: mm / skala.
              setLineWidth(Math.round((e.obwodka.grubosc / s) * 100) / 100),
              drawObject(n),
              popGraphicsState(),
            );
          }
          ops.push(popGraphicsState());
        }
        ops.push(pushGraphicsState(), setFillingRgbColor(r, g, b));
        for (const gl of e.glify) {
          const n = nazwa(gl.klucz, this.refGlifu(scena, gl.klucz), 'G');
          const s = Math.round(gl.skala * 1e6) / 1e6;
          ops.push(
            pushGraphicsState(),
            concatTransformationMatrix(s, 0, 0, -s, r3(gl.x), r3(gl.y)),
            drawObject(n),
            popGraphicsState(),
          );
        }
        ops.push(popGraphicsState());
        return ops;
      }
      case 'obraz': {
        const ref = await this.refObrazu(e.zasob);
        if (!ref) return [];
        const ops: PDFOperator[] = [pushGraphicsState()];
        if (e.przyciecie) {
          const p = e.przyciecie;
          ops.push(rectangle(r3(p.x), r3(p.y), r3(p.szer), r3(p.wys)), clip(), endPath());
        }
        ops.push(
          concatTransformationMatrix(r3(e.szer), 0, 0, -r3(e.wys), r3(e.x), r3(e.y + e.wys)),
          drawObject(nazwa(`obraz:${e.zasob}`, ref, 'Im')),
          popGraphicsState(),
        );
        return ops;
      }
      case 'grupa': {
        const kat = ((e.obrot ?? 0) * Math.PI) / 180;
        const c = Math.round(Math.cos(kat) * 1e6) / 1e6;
        const s = Math.round(Math.sin(kat) * 1e6) / 1e6;
        const ops: PDFOperator[] = [
          pushGraphicsState(),
          concatTransformationMatrix(c, s, -s, c, r3(e.x), r3(e.y)),
        ];
        for (const d of e.elementy) ops.push(...(await this.element(scena, d, strona, nazwa)));
        ops.push(popGraphicsState());
        return ops;
      }
    }
  }
}

export interface WynikPdf {
  bajty: Uint8Array;
  /** Liczba różnych glifów zapisanych w dokumencie (każdy raz). */
  liczbaGlifow: number;
  /** Zasoby obrazów, których nie udało się odczytać (pominięte w PDF). */
  pominieteObrazy: string[];
}

/** Tworzy PDF – jedna strona na scenę. Wynik deterministyczny (stała data utworzenia). */
export async function scenyDoPdf(sceny: Scena[], opcje: OpcjePdf = {}): Promise<WynikPdf> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setProducer('Karty RPG');
  doc.setCreator('Karty RPG');
  if (opcje.tytul) doc.setTitle(opcje.tytul);
  const budowniczy = new BudowniczyPdf(doc, opcje);
  for (const s of sceny) await budowniczy.strona(s);
  const bajty = await doc.save({ useObjectStreams: true });
  return {
    bajty,
    liczbaGlifow: budowniczy.liczbaGlifow,
    pominieteObrazy: [...budowniczy.pominieteObrazy],
  };
}
