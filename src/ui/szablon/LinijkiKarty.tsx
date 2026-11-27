import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { t } from '../../i18n';
import type { LiniaPomocnicza } from '../../model/szablon';
import {
  formatujMmLinii,
  kreskiPrzypietejLinijki,
  mmNaPxLinijki,
  nowaLiniaPomocnicza,
  pxLinijkiNaMm,
  zaokraglijLinie,
} from './linijki';

export interface ProstokatMm {
  x: number;
  y: number;
  szer: number;
  wys: number;
}

interface GestLinii {
  /** Id przesuwanej linii albo undefined przy wyciąganiu nowej z linijki. */
  id?: string;
  os: 'h' | 'v';
  mm: number;
  /** Czy kursor znajduje się nad linijką (upuszczenie usunie/anuluje linię). */
  nadLinijka: boolean;
}

interface PomiarLinijek {
  dlugoscX: number;
  poczatekX: number;
  skalaX: number;
  dlugoscY: number;
  poczatekY: number;
  skalaY: number;
}

const POMIAR_ZEROWY: PomiarLinijek = {
  dlugoscX: 0,
  poczatekX: 0,
  skalaX: 0,
  dlugoscY: 0,
  poczatekY: 0,
  skalaY: 0,
};

/**
 * Przypięte do krawędzi obszaru roboczego linijki (D16) z zerem w lewym górnym rogu karty,
 * pasem zaznaczonego elementu na obu linijkach oraz liniami pomocniczymi (tworzenie przez
 * przeciągnięcie z linijki, przesuwanie, usuwanie przez upuszczenie na linijce).
 * Linijki mają `overflow: hidden` i nigdy nie wychodzą poza obszar roboczy.
 */
export function LinijkiKarty({
  szer,
  wys,
  kartaRef,
  linie,
  widoczne,
  zaznaczenieMm,
  zmienLinie,
  ariaLabel,
  children,
}: {
  szer: number;
  wys: number;
  kartaRef: RefObject<HTMLDivElement | null>;
  linie: readonly LiniaPomocnicza[];
  widoczne: boolean;
  zaznaczenieMm?: ProstokatMm | undefined;
  zmienLinie: (nowe: LiniaPomocnicza[]) => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  const linijkaXRef = useRef<HTMLDivElement>(null);
  const linijkaYRef = useRef<HTMLDivElement>(null);
  const przewijanieRef = useRef<HTMLElement>(null);
  const [pomiar, ustawPomiar] = useState<PomiarLinijek>(POMIAR_ZEROWY);
  const [gest, ustawGest] = useState<GestLinii>();
  const gestRef = useRef<GestLinii | undefined>(undefined);

  const mierz = useCallback(() => {
    const rX = linijkaXRef.current?.getBoundingClientRect();
    const rY = linijkaYRef.current?.getBoundingClientRect();
    const rK = kartaRef.current?.getBoundingClientRect();
    if (!rX || !rY || !rK || rK.width <= 0 || rK.height <= 0 || szer <= 0 || wys <= 0) {
      return;
    }
    const nast: PomiarLinijek = {
      dlugoscX: rX.width,
      poczatekX: rK.left - rX.left,
      skalaX: rK.width / szer,
      dlugoscY: rY.height,
      poczatekY: rK.top - rY.top,
      skalaY: rK.height / wys,
    };
    ustawPomiar((pop) =>
      Math.abs(pop.dlugoscX - nast.dlugoscX) < 0.25 &&
      Math.abs(pop.poczatekX - nast.poczatekX) < 0.25 &&
      Math.abs(pop.skalaX - nast.skalaX) < 0.001 &&
      Math.abs(pop.dlugoscY - nast.dlugoscY) < 0.25 &&
      Math.abs(pop.poczatekY - nast.poczatekY) < 0.25 &&
      Math.abs(pop.skalaY - nast.skalaY) < 0.001
        ? pop
        : nast,
    );
  }, [kartaRef, szer, wys]);

  useLayoutEffect(() => {
    mierz();
    const raf = window.requestAnimationFrame(mierz);
    const sc = przewijanieRef.current;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mierz) : undefined;
    if (ro) {
      if (kartaRef.current) ro.observe(kartaRef.current);
      if (sc) ro.observe(sc);
      if (linijkaXRef.current) ro.observe(linijkaXRef.current);
      if (linijkaYRef.current) ro.observe(linijkaYRef.current);
    }
    sc?.addEventListener('scroll', mierz, { passive: true });
    window.addEventListener('resize', mierz);
    return () => {
      window.cancelAnimationFrame(raf);
      ro?.disconnect();
      sc?.removeEventListener('scroll', mierz);
      window.removeEventListener('resize', mierz);
    };
  }, [mierz, kartaRef]);

  const kreskiX = useMemo(
    () => kreskiPrzypietejLinijki(pomiar.dlugoscX, pomiar.poczatekX, pomiar.skalaX),
    [pomiar.dlugoscX, pomiar.poczatekX, pomiar.skalaX],
  );
  const kreskiY = useMemo(
    () => kreskiPrzypietejLinijki(pomiar.dlugoscY, pomiar.poczatekY, pomiar.skalaY),
    [pomiar.dlugoscY, pomiar.poczatekY, pomiar.skalaY],
  );

  // Przeliczenie pozycji kursora na mm z użyciem tej samej skali co linijka.
  const obliczPozycje = useCallback(
    (os: 'h' | 'v', clientX: number, clientY: number) => {
      const rX = linijkaXRef.current?.getBoundingClientRect();
      const rY = linijkaYRef.current?.getBoundingClientRect();
      if (!rX || !rY || pomiar.skalaX <= 0 || pomiar.skalaY <= 0) {
        return { mm: 0, nadLinijka: true };
      }
      if (os === 'h') {
        const px = clientY - rY.top;
        const surowyMm = pxLinijkiNaMm(px, pomiar.poczatekY, pomiar.skalaY);
        const nadLinijka = clientY <= rX.bottom || clientY > rY.bottom;
        return { mm: zaokraglijLinie(surowyMm), nadLinijka };
      }
      const px = clientX - rX.left;
      const surowyMm = pxLinijkiNaMm(px, pomiar.poczatekX, pomiar.skalaX);
      const nadLinijka = clientX <= rY.right || clientX > rX.right;
      return { mm: zaokraglijLinie(surowyMm), nadLinijka };
    },
    [pomiar.poczatekX, pomiar.poczatekY, pomiar.skalaX, pomiar.skalaY],
  );

  const linieRef = useRef(linie);
  const zmienLinieRef = useRef(zmienLinie);
  const obliczPozycjeRef = useRef(obliczPozycje);
  useEffect(() => {
    linieRef.current = linie;
    zmienLinieRef.current = zmienLinie;
    obliczPozycjeRef.current = obliczPozycje;
  }, [linie, zmienLinie, obliczPozycje]);

  const gestAktywny = Boolean(gest);
  useEffect(() => {
    if (!gestAktywny) return;
    const onMove = (e: PointerEvent) => {
      const biezacy = gestRef.current;
      if (!biezacy) return;
      const { mm, nadLinijka } = obliczPozycjeRef.current(biezacy.os, e.clientX, e.clientY);
      const nast: GestLinii = { ...biezacy, mm, nadLinijka };
      gestRef.current = nast;
      ustawGest(nast);
    };
    const onUp = () => {
      const biezacy = gestRef.current;
      gestRef.current = undefined;
      ustawGest(undefined);
      if (!biezacy) return;
      const biezaceLinie = linieRef.current;
      if (biezacy.nadLinijka) {
        if (biezacy.id) {
          zmienLinieRef.current(biezaceLinie.filter((l) => l.id !== biezacy.id));
        }
        return;
      }
      if (biezacy.id) {
        zmienLinieRef.current(
          biezaceLinie.map((l) => (l.id === biezacy.id ? { ...l, mm: biezacy.mm } : l)),
        );
      } else {
        zmienLinieRef.current([
          ...biezaceLinie,
          nowaLiniaPomocnicza(biezaceLinie, biezacy.os, biezacy.mm),
        ]);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [gestAktywny]);

  const rozpocznijZLinijki = (os: 'h' | 'v', e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const { mm, nadLinijka } = obliczPozycje(os, e.clientX, e.clientY);
    const start: GestLinii = { os, mm, nadLinijka };
    gestRef.current = start;
    ustawGest(start);
  };

  const rozpocznijPrzesuwanie = (linia: LiniaPomocnicza, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const start: GestLinii = { id: linia.id, os: linia.os, mm: linia.mm, nadLinijka: false };
    gestRef.current = start;
    ustawGest(start);
  };

  const maSkale = pomiar.skalaX > 0 && pomiar.skalaY > 0;

  return (
    <div className="edytor-ui2-rama-robocza" data-testid="rama-robocza">
      <div className="edytor-ui2-linijka-rog" aria-hidden="true">
        cm
      </div>

      {/* Górna linijka przypięta do górnej krawędzi obszaru roboczego */}
      <div
        ref={linijkaXRef}
        className="edytor-ui2-linijka-pozioma"
        data-testid="linijka-pozioma"
        role="presentation"
        title={t('edytor.linijkaPozioma')}
        onPointerDown={(e) => rozpocznijZLinijki('h', e)}
      >
        {maSkale && zaznaczenieMm && (
          <div
            className="edytor-ui2-linijka-zazn-x"
            data-testid="linijka-zazn-x"
            style={{
              left: `${mmNaPxLinijki(zaznaczenieMm.x, pomiar.poczatekX, pomiar.skalaX)}px`,
              width: `${Math.max(1, zaznaczenieMm.szer * pomiar.skalaX)}px`,
            }}
          />
        )}
        {kreskiX.map((k) => (
          <span
            key={k.mm}
            className={`edytor-ui2-kreska-x ${k.rodzaj}`}
            style={{ left: `${k.px}px` }}
          />
        ))}
        {kreskiX.map((k) =>
          k.etykieta !== undefined ? (
            <span
              key={`cx-${k.mm}`}
              className="edytor-ui2-kreska-etykieta-x"
              data-testid="cyfra-linijki-x"
              style={{ left: `${k.px + 3}px` }}
            >
              {k.etykieta}
            </span>
          ) : null,
        )}
      </div>

      {/* Lewa linijka przypięta do lewej krawędzi obszaru roboczego */}
      <div
        ref={linijkaYRef}
        className="edytor-ui2-linijka-pionowa"
        data-testid="linijka-pionowa"
        role="presentation"
        title={t('edytor.linijkaPionowa')}
        onPointerDown={(e) => rozpocznijZLinijki('v', e)}
      >
        {maSkale && zaznaczenieMm && (
          <div
            className="edytor-ui2-linijka-zazn-y"
            data-testid="linijka-zazn-y"
            style={{
              top: `${mmNaPxLinijki(zaznaczenieMm.y, pomiar.poczatekY, pomiar.skalaY)}px`,
              height: `${Math.max(1, zaznaczenieMm.wys * pomiar.skalaY)}px`,
            }}
          />
        )}
        {kreskiY.map((k) => (
          <span
            key={k.mm}
            className={`edytor-ui2-kreska-y ${k.rodzaj}`}
            style={{ top: `${k.px}px` }}
          />
        ))}
        {kreskiY.map((k) =>
          k.etykieta !== undefined ? (
            <span
              key={`cy-${k.mm}`}
              className="edytor-ui2-kreska-etykieta-y"
              data-testid="cyfra-linijki-y"
              style={{ top: `${k.px + 2}px` }}
            >
              {k.etykieta}
            </span>
          ) : null,
        )}
      </div>

      {/* Przewijany obszar roboczy z kartą + nakładka linii pomocniczych z tej samej skali */}
      <div className="edytor-ui2-robocze-opakowanie">
        <section
          ref={przewijanieRef}
          className="podglad-szablonu edytor-ui2-robocze"
          aria-label={ariaLabel}
        >
          {children}
        </section>

        {widoczne && maSkale && (
          <div className="edytor-ui2-linie-warstwa" aria-hidden={linie.length === 0 && !gest}>
            {linie.map((l) => {
              const wGesc = gest?.id === l.id;
              const pozMm = wGesc ? gest.mm : l.mm;
              if (wGesc && gest.nadLinijka) return null;
              const px =
                l.os === 'h'
                  ? mmNaPxLinijki(pozMm, pomiar.poczatekY, pomiar.skalaY)
                  : mmNaPxLinijki(pozMm, pomiar.poczatekX, pomiar.skalaX);
              const styl = l.os === 'h' ? { top: `${px}px` } : { left: `${px}px` };
              return (
                <div
                  key={l.id}
                  role="separator"
                  aria-orientation={l.os === 'h' ? 'horizontal' : 'vertical'}
                  aria-label={t('edytor.liniaPomocnicza', {
                    os: l.os === 'h' ? 'Y' : 'X',
                    mm: formatujMmLinii(pozMm),
                  })}
                  data-testid="linia-pomocnicza"
                  data-linia-id={l.id}
                  data-os={l.os}
                  data-mm={String(pozMm)}
                  className={`edytor-ui2-linia ${l.os === 'h' ? 'pozioma' : 'pionowa'}${wGesc ? ' aktywna' : ''}`}
                  style={styl}
                  onPointerDown={(e) => rozpocznijPrzesuwanie(l, e)}
                />
              );
            })}

            {gest && !gest.id && !gest.nadLinijka && (
              <div
                className={`edytor-ui2-linia ${gest.os === 'h' ? 'pozioma' : 'pionowa'} aktywna`}
                style={
                  gest.os === 'h'
                    ? { top: `${mmNaPxLinijki(gest.mm, pomiar.poczatekY, pomiar.skalaY)}px` }
                    : { left: `${mmNaPxLinijki(gest.mm, pomiar.poczatekX, pomiar.skalaX)}px` }
                }
              />
            )}

            {gest && (
              <div
                className="edytor-ui2-linia-etykieta"
                data-testid="etykieta-linii"
                style={
                  gest.os === 'h'
                    ? {
                        top: `${Math.max(4, Math.min(pomiar.dlugoscY - 24, mmNaPxLinijki(gest.mm, pomiar.poczatekY, pomiar.skalaY) + 4))}px`,
                        left: '8px',
                      }
                    : {
                        left: `${Math.max(4, Math.min(pomiar.dlugoscX - 96, mmNaPxLinijki(gest.mm, pomiar.poczatekX, pomiar.skalaX) + 4))}px`,
                        top: '8px',
                      }
                }
              >
                {gest.nadLinijka
                  ? t('edytor.liniaUsunUpusc')
                  : `${gest.os === 'h' ? 'Y' : 'X'}: ${formatujMmLinii(gest.mm)}`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
