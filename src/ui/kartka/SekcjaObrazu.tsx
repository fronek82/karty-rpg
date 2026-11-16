import { useRef, useState } from 'react';
import { ustawDane } from '../../dane/edycja';
import { BladDanych } from '../../dane/schemat';
import { t } from '../../i18n';
import type { Karta, PoleObraz, UstawieniaObrazu } from '../../model/szablon';
import { normalizujUstawieniaObrazu } from '../../silnik/karta';
import type { ProjektWEdycji } from '../useProjekt';
import { SKALA_MIN, wgrajObrazDoKart, zaokr, zmienObrazKarty } from './obrazKarty';

/**
 * Ilustracja zaznaczonych kart: wybór z biblioteki i wgrywanie (dla wszystkich zaznaczonych),
 * a dla jednej karty także kadr (skala, przesunięcie, obrót, dopasowanie, reset).
 * Na kartce: kółko myszy nad zaznaczoną kartą – skala, Alt + przeciąganie – przesunięcie.
 */
export function SekcjaObrazu({
  edycja,
  taliaId,
  karty,
  pole,
}: {
  edycja: ProjektWEdycji;
  taliaId: string;
  karty: Karta[];
  pole: PoleObraz;
}) {
  const { projekt, zmien } = edycja;
  const [blad, ustawBlad] = useState<string>();
  const plik = useRef<HTMLInputElement>(null);
  const obrazy = projekt.zasoby.filter((z) => z.rodzaj === 'obraz');
  const klucz = pole.klucz;
  const wartosci = new Set(karty.map((k) => (klucz ? (k.dane[klucz] ?? '') : '')));
  const wspolna = wartosci.size === 1 ? [...wartosci][0]! : undefined;
  const jedna = karty.length === 1 ? karty[0] : undefined;
  const ustawienia = jedna?.obrazy?.[pole.id];
  const u = normalizujUstawieniaObrazu(ustawienia);
  const ids = karty.map((k) => k.id);
  const zmienObraz = (f: (u: UstawieniaObrazu) => UstawieniaObrazu | undefined, kl: string) =>
    jedna &&
    zmien((p) => zmienObrazKarty(p, taliaId, jedna.id, pole.id, f), {
      klucz: `obraz:${jedna.id}:${kl}`,
    });

  return (
    <fieldset className="sekcja-obrazu">
      <legend>{t('pole.obraz')}</legend>
      {klucz && (
        <div className="wiersz-pol">
          <select
            aria-label={t('kartka.plikObrazu')}
            value={wspolna ?? ''}
            onChange={(e) =>
              zmien((p) =>
                ids.reduce((x, id) => ustawDane(x, taliaId, id, klucz, e.target.value), p),
              )
            }
          >
            {wspolna === undefined && <option value="">{t('kartka.rozne')}</option>}
            <option value="">{t('karta.brakObrazu')}</option>
            {obrazy.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nazwa}
              </option>
            ))}
            {wspolna && !obrazy.some((o) => o.id === wspolna) && (
              <option value={wspolna}>{t('karta.nieznanyObraz', { id: wspolna })}</option>
            )}
          </select>
          <button type="button" onClick={() => plik.current?.click()}>
            {t('karta.wgrajObraz')}
          </button>
          <input
            ref={plik}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            data-testid="plik-obrazu"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              ustawBlad(undefined);
              void wgrajObrazDoKart(edycja, f, taliaId, ids, klucz).catch((err: unknown) =>
                ustawBlad(
                  err instanceof BladDanych
                    ? err.message
                    : String(err instanceof Error ? err.message : err),
                ),
              );
            }}
          />
        </div>
      )}
      {blad && (
        <p role="alert" className="uwaga">
          {blad}
        </p>
      )}
      {jedna && (
        <>
          <div className="wiersz-pol">
            <Liczba
              etykieta={t('karta.skala')}
              wartosc={u.skala ?? 1}
              krok={0.05}
              min={SKALA_MIN}
              zmiana={(v) => zmienObraz((x) => ({ ...x, skala: v }), 'skala')}
            />
            <Liczba
              etykieta={t('karta.obrot')}
              wartosc={u.obrot ?? 0}
              krok={1}
              zmiana={(v) => zmienObraz((x) => ({ ...x, obrot: v }), 'obrot')}
            />
          </div>
          <div className="wiersz-pol">
            <Liczba
              etykieta={t('karta.przesuniecieX')}
              wartosc={u.przesuniecie?.x ?? 0}
              krok={0.5}
              zmiana={(v) =>
                zmienObraz(
                  (x) => ({ ...x, przesuniecie: { x: v, y: x.przesuniecie?.y ?? 0 } }),
                  'x',
                )
              }
            />
            <Liczba
              etykieta={t('karta.przesuniecieY')}
              wartosc={u.przesuniecie?.y ?? 0}
              krok={0.5}
              zmiana={(v) =>
                zmienObraz(
                  (x) => ({ ...x, przesuniecie: { x: x.przesuniecie?.x ?? 0, y: v } }),
                  'y',
                )
              }
            />
          </div>
          <div className="wiersz-pol">
            <label>
              {t('karta.dopasowanie')}{' '}
              <select
                value={ustawienia?.dopasowanie ?? ''}
                onChange={(e) =>
                  zmienObraz((x) => {
                    const { dopasowanie: _d, ...reszta } = x;
                    void _d;
                    const v = e.target.value as UstawieniaObrazu['dopasowanie'] | '';
                    return v ? { ...reszta, dopasowanie: v } : reszta;
                  }, 'dopasowanie')
                }
              >
                <option value="">
                  {t('karta.dopasowanieSzablonu', { tryb: t(`karta.tryb.${pole.dopasowanie}`) })}
                </option>
                <option value="dopasuj">{t('karta.tryb.dopasuj')}</option>
                <option value="wypelnij">{t('karta.tryb.wypelnij')}</option>
                <option value="rozciagnij">{t('karta.tryb.rozciagnij')}</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!ustawienia}
              onClick={() => zmienObraz(() => undefined, 'reset')}
            >
              {t('karta.resetuj')}
            </button>
          </div>
          <p className="podpis">{t('kartka.wskazowkaObrazu')}</p>
        </>
      )}
    </fieldset>
  );
}

function Liczba({
  etykieta,
  wartosc,
  krok,
  min,
  zmiana,
}: {
  etykieta: string;
  wartosc: number;
  krok: number;
  min?: number;
  zmiana: (v: number) => void;
}) {
  return (
    <label>
      {etykieta}{' '}
      <input
        type="number"
        step={krok}
        min={min}
        value={zaokr(wartosc, 3)}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          if (Number.isFinite(v) && (min === undefined || v >= min)) zmiana(v);
        }}
      />
    </label>
  );
}
