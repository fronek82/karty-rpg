import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { t } from '../../i18n';
import type { LiniaPomocnicza } from '../../model/szablon';
import {
  formatujMmLinii,
  kreskiLinijki,
  mmNaProcentLinijki,
  nowaLiniaPomocnicza,
  pxNaMm,
  WYSTAWANIE_MM,
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

/**
 * Opakowanie podglądu karty z linijkami w mm (zero w lewym górnym rogu karty, wystawanie 10 mm),
 * pasem zaznaczonego elementu na obu linijkach oraz liniami pomocniczymi (tworzenie, przesuwanie,
 * usuwanie przez upuszczenie na linijce). Linie nigdy nie trafiają do SVG ani PDF.
 */
export function LinijkiKarty({
  szer,
  wys,
  kartaRef,
  linie,
  widoczne,
  zaznaczenieMm,
  zmienLinie,
  children,
}: {
  szer: number;
  wys: number;
  kartaRef: RefObject<HTMLDivElement | null>;
  linie: readonly LiniaPomocnicza[];
  widoczne: boolean;
  zaznaczenieMm?: ProstokatMm | undefined;
  zmienLinie: (nowe: LiniaPomocnicza[]) => void;
  children: ReactNode;
}) {
  const [gest, ustawGest] = useState<GestLinii>();
  const gestRef = useRef<GestLinii | undefined>(undefined);
  const kreskiX = useMemo(() => kreskiLinijki(szer, WYSTAWANIE_MM), [szer]);
  const kreskiY = useMemo(() => kreskiLinijki(wys, WYSTAWANIE_MM), [wys]);

  // Przeliczenie pozycji kursora na mm względem lewego górnego rogu karty.
  const obliczPozycje = (os: 'h' | 'v', clientX: number, clientY: number) => {
    const rect = kartaRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return { mm: 0, nadLinijka: true };
    }
    const px = os === 'h' ? clientY - rect.top : clientX - rect.left;
    const dlPx = os === 'h' ? rect.height : rect.width;
    const dlMm = os === 'h' ? wys : szer;
    const surowyMm = pxNaMm(px, dlPx, dlMm);
    // Jeśli kursor znajduje się nad linijką (poniżej -1 mm poza krawędzią karty) – upuszczenie usuwa linię.
    const nadLinijka = surowyMm < -1 || surowyMm > dlMm + WYSTAWANIE_MM;
    return { mm: zaokraglijLinie(surowyMm), nadLinijka };
  };

  useEffect(() => {
    if (!gest) return;
    const onMove = (e: PointerEvent) => {
      const biezacy = gestRef.current;
      if (!biezacy) return;
      const { mm, nadLinijka } = obliczPozycje(biezacy.os, e.clientX, e.clientY);
      const nast: GestLinii = { ...biezacy, mm, nadLinijka };
      gestRef.current = nast;
      ustawGest(nast);
    };
    const onUp = () => {
      const biezacy = gestRef.current;
      gestRef.current = undefined;
      ustawGest(undefined);
      if (!biezacy) return;
      if (biezacy.nadLinijka) {
        if (biezacy.id) {
          zmienLinie(linie.filter((l) => l.id !== biezacy.id));
        }
        return;
      }
      if (biezacy.id) {
        zmienLinie(linie.map((l) => (l.id === biezacy.id ? { ...l, mm: biezacy.mm } : l)));
      } else {
        zmienLinie([...linie, nowaLiniaPomocnicza(linie, biezacy.os, biezacy.mm)]);
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
  });

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

  const wystawanieXProc = (WYSTAWANIE_MM / szer) * 100;
  const wystawanieYProc = (WYSTAWANIE_MM / wys) * 100;

  return (
    <div className="edytor-ui2-scena-z-linijkami">
      <div className="edytor-ui2-linijka-rog" aria-hidden="true">
        mm
      </div>

      {/* Górna linijka (pozioma) – zero na lewej krawędzi karty */}
      <div
        className="edytor-ui2-linijka-pozioma"
        data-testid="linijka-pozioma"
        role="presentation"
        title={t('edytor.linijkaPozioma')}
        onPointerDown={(e) => rozpocznijZLinijki('h', e)}
      >
        <div
          className="edytor-ui2-linijka-tor-x"
          style={{
            left: `${-wystawanieXProc}%`,
            width: `${100 + 2 * wystawanieXProc}%`,
          }}
        >
          {zaznaczenieMm && (
            <div
              className="edytor-ui2-linijka-zazn-x"
              data-testid="linijka-zazn-x"
              style={{
                left: `${mmNaProcentLinijki(zaznaczenieMm.x, szer, WYSTAWANIE_MM)}%`,
                width: `${(zaznaczenieMm.szer / (szer + 2 * WYSTAWANIE_MM)) * 100}%`,
              }}
            />
          )}
          {kreskiX.map((k) => (
            <span
              key={k.mm}
              className={`edytor-ui2-kreska-x ${k.rodzaj}`}
              style={{ left: `${mmNaProcentLinijki(k.mm, szer, WYSTAWANIE_MM)}%` }}
            >
              {k.etykieta !== undefined && (
                <span className="edytor-ui2-kreska-etykieta-x">{k.etykieta}</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Lewa linijka (pionowa) – zero na górnej krawędzi karty */}
      <div
        className="edytor-ui2-linijka-pionowa"
        data-testid="linijka-pionowa"
        role="presentation"
        title={t('edytor.linijkaPionowa')}
        onPointerDown={(e) => rozpocznijZLinijki('v', e)}
      >
        <div
          className="edytor-ui2-linijka-tor-y"
          style={{
            top: `${-wystawanieYProc}%`,
            height: `${100 + 2 * wystawanieYProc}%`,
          }}
        >
          {zaznaczenieMm && (
            <div
              className="edytor-ui2-linijka-zazn-y"
              data-testid="linijka-zazn-y"
              style={{
                top: `${mmNaProcentLinijki(zaznaczenieMm.y, wys, WYSTAWANIE_MM)}%`,
                height: `${(zaznaczenieMm.wys / (wys + 2 * WYSTAWANIE_MM)) * 100}%`,
              }}
            />
          )}
          {kreskiY.map((k) => (
            <span
              key={k.mm}
              className={`edytor-ui2-kreska-y ${k.rodzaj}`}
              style={{ top: `${mmNaProcentLinijki(k.mm, wys, WYSTAWANIE_MM)}%` }}
            >
              {k.etykieta !== undefined && (
                <span className="edytor-ui2-kreska-etykieta-y">{k.etykieta}</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Obszar karty + nakładka linii pomocniczych */}
      <div className="edytor-ui2-karta-obszar">
        {children}

        {widoczne && (
          <div className="edytor-ui2-linie-warstwa" aria-hidden={linie.length === 0 && !gest}>
            {linie.map((l) => {
              const wGesc = gest?.id === l.id;
              const pozMm = wGesc ? gest.mm : l.mm;
              if (wGesc && gest.nadLinijka) return null;
              const styl =
                l.os === 'h'
                  ? { top: `${(pozMm / wys) * 100}%` }
                  : { left: `${(pozMm / szer) * 100}%` };
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
                    ? { top: `${(gest.mm / wys) * 100}%` }
                    : { left: `${(gest.mm / szer) * 100}%` }
                }
              />
            )}

            {gest && (
              <div
                className="edytor-ui2-linia-etykieta"
                data-testid="etykieta-linii"
                style={
                  gest.os === 'h'
                    ? { top: `${Math.max(0, Math.min(100, (gest.mm / wys) * 100))}%`, left: '8px' }
                    : { left: `${Math.max(0, Math.min(100, (gest.mm / szer) * 100))}%`, top: '8px' }
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
