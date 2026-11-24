import { konturOkregu, konturProstokata } from '../silnik/konturyFigur';
import {
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  PDFRef,
  PDFString,
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
  setGraphicsState,
  setLineJoin,
  setLineWidth,
  setStrokingRgbColor,
  LineCapStyle,
  LineJoinStyle,
  setLineCap,
  stroke,
} from 'pdf-lib';
import { PT_NA_MM } from '../model/jednostki';
import type { Kolor } from '../model/szablon';
import {
  czyObrys,
  kolorSceny,
  rozwinWzor,
  type DefinicjaSymbolu,
  type ElementSceny,
  type GlifNaScenie,
  type Kontur,
  type Obrys,
  type Scena,
  type WierszTekstuSceny,
} from '../silnik/scena';
import { zaokraglij } from '../model/geometria';

/**
 * Serializator sceny do PDF (pdf-lib). Każda scena = jedna strona o wymiarach sceny.
 * Tekst jako krzywe: każdy glif zapisany w dokumencie RAZ jako Form XObject
 * i wstawiany operatorem `Do` – PDF nie puchnie przy dużej ilości tekstu.
 * Opcjonalnie dodaje niewidoczną warstwę tekstową (`3 Tr`, Type0 + ToUnicode) do wyszukiwania
 * i kopiowania polskich znaków bez jakiejkolwiek zmiany w pikselach.
 */

export interface ObrazDoPdf {
  dane: Uint8Array;
  format: 'png' | 'jpg';
}

export interface OpcjePdf {
  obraz?: (zasob: string) => ObrazDoPdf | undefined;
  tytul?: string;
  /** Dodaje niewidoczną warstwę tekstową (`3 Tr`) do wyszukiwania i kopiowania tekstu w PDF. */
  warstwaTekstowa?: boolean;
}

const r3 = (v: number) => zaokraglij(v, 3);

function kolorRgb(k: Kolor): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(kolorSceny(k));
  if (!m) return [0, 0, 0];
  return [parseInt(m[1]!, 16) / 255, parseInt(m[2]!, 16) / 255, parseInt(m[3]!, 16) / 255].map(
    (v) => zaokraglij(v, 3),
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

function ustawObrys(o: Obrys): PDFOperator[] {
  const [r, g, b] = kolorRgb(o.kolor);
  return [
    setStrokingRgbColor(r, g, b),
    setLineWidth(r3(o.grubosc)),
    setDashPattern(o.kreska ? o.kreska.map(r3) : [], o.kreska ? r3(o.fazaKreski ?? 0) : 0),
  ];
}

/** Operator malujący ścieżkę: wypełnienie (nonzero albo parzysto-nieparzyste) i/lub obrys. */
function operatorMalowania(wypelnione: boolean, obrys: boolean, evenodd: boolean): PDFOperator {
  if (wypelnione && obrys)
    return evenodd ? PDFOperator.of(PDFOperatorNames.FillEvenOddAndStroke) : fillAndStroke();
  if (wypelnione) return evenodd ? PDFOperator.of(PDFOperatorNames.FillEvenOdd) : fill();
  return stroke();
}

function rysujKsztalt(
  kontur: Kontur,
  wyp: Kolor | undefined,
  obrys: Obrys | undefined,
  evenodd = false,
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
  ops.push(operatorMalowania(!!wyp, !!o, evenodd));
  ops.push(popGraphicsState());
  return ops;
}

interface ZasobyPdf {
  xObject: (klucz: string, ref: PDFRef, przedrostek: string) => PDFName;
  extGState: (krycie: number) => PDFName;
  fontTekstu: () => PDFName;
}

const MAKS_BFCHAR_W_BLOKU = 100;
const MAKS_CID = 65534;
const SZEROKOSC_DOMYSLNA_CID = 500;

/** Koduje pojedynczy punkt kodowy Unicode (także spoza BMP – para surogatów) jako hex UTF-16BE. */
function utf16BeHex(znak: string): string {
  let wynik = '';
  for (let i = 0; i < znak.length; i++) {
    wynik += znak.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  }
  return wynik;
}

/** Buduje strumień CMap `ToUnicode` zgodny z ISO 32000-1 (bloki po max 100 wpisów `bfchar`). */
function zbudujToUnicodeCMap(znaki: Map<string, number>): string {
  const wpisy = [...znaki.entries()].map(
    ([znak, cid]) => `<${cid.toString(16).toUpperCase().padStart(4, '0')}> <${utf16BeHex(znak)}>`,
  );
  const sekcje: string[] = [];
  for (let i = 0; i < wpisy.length; i += MAKS_BFCHAR_W_BLOKU) {
    const porcja = wpisy.slice(i, i + MAKS_BFCHAR_W_BLOKU);
    sekcje.push(`${porcja.length} beginbfchar\n${porcja.join('\n')}\nendbfchar`);
  }
  return [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
    ...sekcje,
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n');
}

function macierzGlifu(gl: GlifNaScenie): PDFOperator {
  if (!gl.obrot) {
    const s = Math.round(gl.skala * 1e6) / 1e6;
    return concatTransformationMatrix(s, 0, 0, -s, r3(gl.x), r3(gl.y));
  }
  const kat = (gl.obrot * Math.PI) / 180;
  const a = Math.round(gl.skala * Math.cos(kat) * 1e6) / 1e6;
  const b = Math.round(gl.skala * Math.sin(kat) * 1e6) / 1e6;
  return concatTransformationMatrix(a, b, b, -a, r3(gl.x), r3(gl.y));
}

class BudowniczyPdf {
  /** Glif → referencja do XObject (wspólna dla wszystkich stron). */
  private readonly glifyXObject = new Map<string, PDFRef>();
  /** Symbol → XObject (bez koloru dla części `'kolor'` – dziedziczą go z miejsca wstawienia). */
  private readonly symboleXObject = new Map<string, PDFRef>();
  private readonly obrazy = new Map<string, PDFRef>();
  /** Krycie (zaokrąglone do 0,0001) → wspólny obiekt ExtGState. */
  private readonly stanyKrycia = new Map<number, PDFRef>();
  /** Mapa znak Unicode → CID (1..65534) dla opcjonalnej niewidocznej warstwy tekstowej. */
  private readonly znakiTekstu = new Map<string, number>();
  private refCzcionkiTekstu?: PDFRef;
  private licznikGlifow = 0;
  private licznikGrup = 0;
  readonly pominieteObrazy = new Set<string>();

  constructor(
    private readonly doc: PDFDocument,
    private readonly opcje: OpcjePdf,
  ) {}

  private pobierzRefCzcionkiTekstu(): PDFRef {
    if (!this.refCzcionkiTekstu) {
      this.refCzcionkiTekstu = this.doc.context.nextRef();
    }
    return this.refCzcionkiTekstu;
  }

  private kodujTekst(tekst: string): { hex: string; dlugosc: number } {
    let hex = '';
    let dlugosc = 0;
    for (const znak of tekst) {
      let cid = this.znakiTekstu.get(znak);
      if (cid === undefined) {
        if (this.znakiTekstu.size >= MAKS_CID) continue;
        cid = this.znakiTekstu.size + 1;
        this.znakiTekstu.set(znak, cid);
      }
      hex += cid.toString(16).toUpperCase().padStart(4, '0');
      dlugosc++;
    }
    return { hex, dlugosc };
  }

  private operatoryWarstwyTekstowej(
    wiersze: readonly WierszTekstuSceny[],
    pobierzFont: () => PDFName,
  ): PDFOperator[] {
    const zakodowane: { wiersz: WierszTekstuSceny; hex: string; dlugosc: number }[] = [];
    for (const wiersz of wiersze) {
      if (!wiersz.tekst) continue;
      const { hex, dlugosc } = this.kodujTekst(wiersz.tekst);
      if (dlugosc > 0) zakodowane.push({ wiersz, hex, dlugosc });
    }
    if (zakodowane.length === 0) return [];
    const nazwaFontu = pobierzFont();
    const ops: PDFOperator[] = [
      pushGraphicsState(),
      PDFOperator.of(PDFOperatorNames.BeginText),
      // Tryb 3 Tr: tekst niewidoczny (ani wypełnienie, ani obrys) – 0 zmian w pikselach.
      PDFOperator.of(PDFOperatorNames.SetTextRenderingMode, [PDFNumber.of(3)]),
    ];
    for (const { wiersz, hex, dlugosc } of zakodowane) {
      const rozmiar = Math.max(0.5, wiersz.rozmiar);
      const szerNaturalna = dlugosc * (SZEROKOSC_DOMYSLNA_CID / 1000) * rozmiar;
      const tz = Math.max(10, Math.min(400, (wiersz.szer / Math.max(0.1, szerNaturalna)) * 100));
      ops.push(
        PDFOperator.of(PDFOperatorNames.SetFontAndSize, [nazwaFontu, PDFNumber.of(r3(rozmiar))]),
        PDFOperator.of(PDFOperatorNames.SetTextHorizontalScaling, [PDFNumber.of(r3(tz))]),
        // Wewnątrz układu strony Y w dół macierz (1, 0, 0, -1, x, y) przywraca pionowy tekst w górę.
        PDFOperator.of(PDFOperatorNames.SetTextMatrix, [
          PDFNumber.of(1),
          PDFNumber.of(0),
          PDFNumber.of(0),
          PDFNumber.of(-1),
          PDFNumber.of(r3(wiersz.x)),
          PDFNumber.of(r3(wiersz.y)),
        ]),
        PDFOperator.of(PDFOperatorNames.ShowText, [PDFHexString.of(hex)]),
      );
    }
    ops.push(PDFOperator.of(PDFOperatorNames.EndText), popGraphicsState());
    return ops;
  }

  /** Finalizuje współdzieloną czcionkę Type0 + ToUnicode po przetworzeniu wszystkich stron. */
  zakoncz(): void {
    if (!this.refCzcionkiTekstu || this.znakiTekstu.size === 0) return;
    const toUnicodeRef = this.doc.context.register(
      this.doc.context.flateStream(zbudujToUnicodeCMap(this.znakiTekstu)),
    );
    const deskryptorRef = this.doc.context.register(
      this.doc.context.obj({
        Type: 'FontDescriptor',
        FontName: PDFName.of('KartyRpgText'),
        Flags: 4,
        FontBBox: [0, -200, 1000, 800],
        ItalicAngle: 0,
        Ascent: 800,
        Descent: -200,
        CapHeight: 700,
        StemV: 80,
      }),
    );
    const cidFontRef = this.doc.context.register(
      this.doc.context.obj({
        Type: 'Font',
        Subtype: 'CIDFontType2',
        BaseFont: PDFName.of('KartyRpgText'),
        CIDSystemInfo: {
          Registry: PDFString.of('Adobe'),
          Ordering: PDFString.of('Identity'),
          Supplement: 0,
        },
        FontDescriptor: deskryptorRef,
        CIDToGIDMap: PDFName.of('Identity'),
        DW: SZEROKOSC_DOMYSLNA_CID,
      }),
    );
    this.doc.context.assign(
      this.refCzcionkiTekstu,
      this.doc.context.obj({
        Type: 'Font',
        Subtype: 'Type0',
        BaseFont: PDFName.of('KartyRpgText'),
        Encoding: PDFName.of('Identity-H'),
        DescendantFonts: [cidFontRef],
        ToUnicode: toUnicodeRef,
      }),
    );
  }

  private refKrycia(krycie: number): PDFRef {
    const a = zaokraglij(Math.max(0, Math.min(1, krycie)), 4);
    const istniejacy = this.stanyKrycia.get(a);
    if (istniejacy) return istniejacy;
    const ref = this.doc.context.register(
      this.doc.context.obj({ Type: 'ExtGState', ca: a, CA: a }),
    );
    this.stanyKrycia.set(a, ref);
    return ref;
  }

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
        ? [...operatorySciezki(kontur, (v) => zaokraglij(v, 2)), obwodka ? fillAndStroke() : fill()]
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

  get liczbaSymboli(): number {
    return this.symboleXObject.size;
  }

  /** XObject symbolu – zapisany raz w dokumencie, wstawiany operatorem `Do` z `cm` i kolorem. */
  private refSymbolu(klucz: string, d: DefinicjaSymbolu): PDFRef {
    const istniejacy = this.symboleXObject.get(klucz);
    if (istniejacy) return istniejacy;
    const ops: PDFOperator[] = [];
    let zapas = 0;
    for (const c of d.kontury) {
      const o = c.obrys && c.obrys.grubosc > 0 ? c.obrys : undefined;
      if (c.wypelnienie === undefined && !o) continue;
      ops.push(pushGraphicsState());
      if (c.wypelnienie !== undefined && c.wypelnienie !== 'kolor') {
        const [r, g, b] = kolorRgb(c.wypelnienie);
        ops.push(setFillingRgbColor(r, g, b));
      }
      if (o) {
        if (o.kolor !== 'kolor') {
          const [r, g, b] = kolorRgb(o.kolor);
          ops.push(setStrokingRgbColor(r, g, b));
        }
        ops.push(
          setLineWidth(Math.round(o.grubosc * 1e4) / 1e4),
          setLineJoin(LineJoinStyle.Round),
          setLineCap(LineCapStyle.Round),
        );
        zapas = Math.max(zapas, o.grubosc);
      }
      ops.push(...operatorySciezki(c.kontur, (v) => Math.round(v * 1e4) / 1e4));
      ops.push(operatorMalowania(c.wypelnienie !== undefined, !!o, !!c.evenodd));
      ops.push(popGraphicsState());
    }
    const m = Math.ceil(zapas) + 1;
    const strumien = this.doc.context.formXObject(ops, {
      BBox: [-m, -m, Math.ceil(d.szer) + m, Math.ceil(d.wys) + m],
    });
    const ref = this.doc.context.register(strumien);
    this.symboleXObject.set(klucz, ref);
    return ref;
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
    const stany = new Map<number, PDFName>();
    let nrGs = 0;
    let zarejestrowanoFontTekstu = false;
    const nazwaFontuTekstu = PDFName.of('FTxt');
    const zasoby: ZasobyPdf = {
      xObject: (klucz, ref, przedrostek) => {
        let n = nazwy.get(klucz);
        if (!n) {
          n = strona.node.newXObject(przedrostek, ref);
          nazwy.set(klucz, n);
        }
        return n;
      },
      extGState: (krycie) => {
        const a = zaokraglij(Math.max(0, Math.min(1, krycie)), 4);
        let n = stany.get(a);
        if (!n) {
          n = PDFName.of(`GS${++nrGs}`);
          strona.node.setExtGState(n, this.refKrycia(a));
          stany.set(a, n);
        }
        return n;
      },
      fontTekstu: () => {
        if (!zarejestrowanoFontTekstu) {
          strona.node.setFontDictionary(nazwaFontuTekstu, this.pobierzRefCzcionkiTekstu());
          zarejestrowanoFontTekstu = true;
        }
        return nazwaFontuTekstu;
      },
    };
    // Układ współrzędnych strony: mm, oś Y w dół, początek w lewym górnym rogu.
    const ops: PDFOperator[] = [
      pushGraphicsState(),
      concatTransformationMatrix(PT_NA_MM, 0, 0, -PT_NA_MM, 0, scena.wys * PT_NA_MM),
    ];
    for (const e of scena.elementy) ops.push(...(await this.element(scena, e, zasoby)));
    ops.push(popGraphicsState());
    if (stany.size > 0) {
      strona.node.set(
        PDFName.of('Group'),
        this.doc.context.obj({ Type: 'Group', S: 'Transparency', CS: 'DeviceRGB' }),
      );
    }
    strona.pushOperators(...ops);
  }

  private async element(scena: Scena, e: ElementSceny, zasoby: ZasobyPdf): Promise<PDFOperator[]> {
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
        return rysujKsztalt(e.kontur, e.wypelnienie, e.obrys, e.evenodd);
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
            const n = zasoby.xObject(
              `${gl.klucz}|obwodka`,
              this.refGlifu(scena, gl.klucz, true),
              'O',
            );
            const s = Math.round(gl.skala * 1e6) / 1e6;
            ops.push(
              pushGraphicsState(),
              macierzGlifu(gl),
              // Grubość w jednostkach glifu: mm / skala.
              setLineWidth(zaokraglij(e.obwodka.grubosc / s, 2)),
              drawObject(n),
              popGraphicsState(),
            );
          }
          ops.push(popGraphicsState());
        }
        ops.push(pushGraphicsState(), setFillingRgbColor(r, g, b));
        for (const gl of e.glify) {
          const n = zasoby.xObject(gl.klucz, this.refGlifu(scena, gl.klucz), 'G');
          ops.push(pushGraphicsState(), macierzGlifu(gl), drawObject(n), popGraphicsState());
        }
        ops.push(popGraphicsState());
        if (this.opcje.warstwaTekstowa && e.wierszeTekst && e.wierszeTekst.length > 0) {
          const opsTekstu = this.operatoryWarstwyTekstowej(e.wierszeTekst, zasoby.fontTekstu);
          if (opsTekstu.length > 0) ops.push(...opsTekstu);
        }
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
        if (e.obrot) {
          // Obrót wokół środka obrazu (oś Y w dół – dodatni kąt zgodnie z ruchem wskazówek).
          const kat = (e.obrot * Math.PI) / 180;
          const c = Math.round(Math.cos(kat) * 1e6) / 1e6;
          const s = Math.round(Math.sin(kat) * 1e6) / 1e6;
          const cx = e.x + e.szer / 2;
          const cy = e.y + e.wys / 2;
          ops.push(
            concatTransformationMatrix(
              c,
              s,
              -s,
              c,
              r3(cx - c * cx + s * cy),
              r3(cy - s * cx - c * cy),
            ),
          );
        }
        ops.push(
          concatTransformationMatrix(r3(e.szer), 0, 0, -r3(e.wys), r3(e.x), r3(e.y + e.wys)),
          drawObject(zasoby.xObject(`obraz:${e.zasob}`, ref, 'Im')),
          popGraphicsState(),
        );
        return ops;
      }
      case 'symbol': {
        const d = scena.symbole?.[e.klucz];
        if (!d) return [];
        const n = zasoby.xObject(`S|${e.klucz}`, this.refSymbolu(e.klucz, d), 'S');
        const [r, g, b] = kolorRgb(e.kolor ?? '#000000');
        const m = e.macierz;
        const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
        return [
          pushGraphicsState(),
          concatTransformationMatrix(r6(m[0]), r6(m[1]), r6(m[2]), r6(m[3]), r3(m[4]), r3(m[5])),
          setFillingRgbColor(r, g, b),
          setStrokingRgbColor(r, g, b),
          drawObject(n),
          popGraphicsState(),
        ];
      }
      case 'wzor':
        // PDF bez wzorów kafelkowych: kopie wektorowe (symbole jako XObject – każdy zapisany raz).
        return this.element(scena, rozwinWzor(e), zasoby);
      case 'grupa': {
        if (e.krycie !== undefined && e.krycie <= 0) return [];
        const kat = ((e.obrot ?? 0) * Math.PI) / 180;
        const c = Math.round(Math.cos(kat) * 1e6) / 1e6;
        const s = Math.round(Math.sin(kat) * 1e6) / 1e6;
        const ops: PDFOperator[] = [pushGraphicsState()];
        // Przycięcie w układzie otaczającym – przed przekształceniem grupy.
        if (e.przyciecieKonturem)
          ops.push(...operatorySciezki(e.przyciecieKonturem), clip(), endPath());
        if (e.przyciecie) {
          const p = e.przyciecie;
          ops.push(rectangle(r3(p.x), r3(p.y), r3(p.szer), r3(p.wys)), clip(), endPath());
        }
        ops.push(concatTransformationMatrix(c, s, -s, c, r3(e.x), r3(e.y)));
        if (e.macierz) {
          const m = e.macierz;
          const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
          ops.push(
            concatTransformationMatrix(r6(m[0]), r6(m[1]), r6(m[2]), r6(m[3]), r3(m[4]), r3(m[5])),
          );
        }
        if (e.krycie !== undefined && e.krycie < 1) {
          // Izolowana grupa przezroczystości (PDF 1.7 Transparency Group) – identyczne mieszanie jak SVG <g opacity>.
          const lokalneX = new Map<string, { nazwa: PDFName; ref: PDFRef }>();
          const lokalneGs = new Map<number, { nazwa: PDFName; ref: PDFRef }>();
          let nrX = 0;
          let nrGs = 0;
          let uzytyFontTekstu = false;
          const nazwaFontuTekstu = PDFName.of('FTxt');
          const zasobyGrupy: ZasobyPdf = {
            xObject: (klucz, ref, przedrostek) => {
              let wpis = lokalneX.get(klucz);
              if (!wpis) {
                wpis = { nazwa: PDFName.of(`${przedrostek}${++nrX}`), ref };
                lokalneX.set(klucz, wpis);
              }
              return wpis.nazwa;
            },
            extGState: (krycie) => {
              const a = zaokraglij(Math.max(0, Math.min(1, krycie)), 4);
              let wpis = lokalneGs.get(a);
              if (!wpis) {
                wpis = { nazwa: PDFName.of(`GS${++nrGs}`), ref: this.refKrycia(a) };
                lokalneGs.set(a, wpis);
              }
              return wpis.nazwa;
            },
            fontTekstu: () => {
              uzytyFontTekstu = true;
              return nazwaFontuTekstu;
            },
          };
          // Wewnątrz Form XObject zerujemy odziedziczone ca/CA do 1, żeby krycie nie mnożyło się podwójnie.
          const wewOps: PDFOperator[] = [setGraphicsState(zasobyGrupy.extGState(1))];
          for (const d of e.elementy) wewOps.push(...(await this.element(scena, d, zasobyGrupy)));
          const zasobyDict: Record<string, PDFDict> = {};
          if (lokalneX.size > 0) {
            const xo = this.doc.context.obj({});
            for (const { nazwa, ref } of lokalneX.values()) xo.set(nazwa, ref);
            zasobyDict.XObject = xo;
          }
          if (lokalneGs.size > 0) {
            const gs = this.doc.context.obj({});
            for (const { nazwa, ref } of lokalneGs.values()) gs.set(nazwa, ref);
            zasobyDict.ExtGState = gs;
          }
          if (uzytyFontTekstu) {
            const fonty = this.doc.context.obj({});
            fonty.set(nazwaFontuTekstu, this.pobierzRefCzcionkiTekstu());
            zasobyDict.Font = fonty;
          }
          const zasieg = Math.ceil(Math.max(scena.szer, scena.wys) * 2 + 50);
          const strumien = this.doc.context.formXObject(wewOps, {
            BBox: [-zasieg, -zasieg, zasieg, zasieg],
            Group: this.doc.context.obj({
              Type: 'Group',
              S: 'Transparency',
              CS: 'DeviceRGB',
              I: true,
              K: false,
            }),
            Resources: this.doc.context.obj(zasobyDict),
          });
          const refForm = this.doc.context.register(strumien);
          const nazwaForm = zasoby.xObject(`T|${++this.licznikGrup}`, refForm, 'T');
          ops.push(setGraphicsState(zasoby.extGState(e.krycie)), drawObject(nazwaForm));
        } else {
          for (const d of e.elementy) ops.push(...(await this.element(scena, d, zasoby)));
        }
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
  /** Liczba różnych symboli (ozdobników) zapisanych w dokumencie jako XObject (każdy raz). */
  liczbaSymboli: number;
  /** Zasoby obrazów, których nie udało się odczytać (pominięte w PDF). */
  pominieteObrazy: string[];
}

/** Tworzy PDF – jedna strona na scenę. Wynik deterministyczny (stała data utworzenia). */
export async function scenyDoPdf(sceny: Scena[], opcje: OpcjePdf = {}): Promise<WynikPdf> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setProducer('Karty');
  doc.setCreator('Karty');
  if (opcje.tytul) doc.setTitle(opcje.tytul);
  const budowniczy = new BudowniczyPdf(doc, opcje);
  for (const s of sceny) await budowniczy.strona(s);
  budowniczy.zakoncz();
  const bajty = await doc.save({ useObjectStreams: true });
  return {
    bajty,
    liczbaGlifow: budowniczy.liczbaGlifow,
    liczbaSymboli: budowniczy.liczbaSymboli,
    pominieteObrazy: [...budowniczy.pominieteObrazy],
  };
}
