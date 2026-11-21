import { useEffect, useId, useState } from 'react';
import { dodajSzablon, eksportujSzablon, importujSzablon } from '../../dane/archiwum';
import { czyProjektRewersowy, type WpisAwersuZProjektu } from '../../dane/baza';
import { przypiszRewers } from '../../dane/rewers';
import { slotSzablonu } from '../../dane/wlasneKarty';
import { t } from '../../i18n';
import type { Talia } from '../../model/szablon';
import { baza } from '../baza';
import { PodgladRewersu } from '../rewers/PodgladRewersu';
import {
  dolaczRewersGlobalnyDoProjektu,
  PRZEDROSTEK_OPCJI_GLOBALNEJ,
  useRewersyGlobalne,
} from '../rewersyGlobalne';
import type { ProjektWEdycji } from '../useProjekt';

/**
 * Sekcja w prawym panelu Edytora kart (gdy żadna karta nie jest zaznaczona):
 * - dla projektu rewersowego: wybór awersu z istniejących projektów w przeglądarce;
 * - dla każdego projektu: wybór rewersu dla wszystkich kart w talii.
 */
export function PanelRewersuIAwersu({
  edycja,
  talia,
}: {
  edycja: ProjektWEdycji;
  talia: Talia | undefined;
}) {
  const { projekt, zmien } = edycja;
  const projektRewersowy = czyProjektRewersowy(projekt);
  const { rewersyGlobalne } = useRewersyGlobalne(projekt);
  const [awersy, ustawAwersy] = useState<WpisAwersuZProjektu[]>([]);
  const [status, ustawStatus] = useState('');
  const [blad, ustawBlad] = useState('');
  const [trwa, ustawTrwa] = useState(false);
  const idAwersu = useId();
  const idRewersu = useId();

  useEffect(() => {
    if (!projektRewersowy) return;
    let aktywny = true;
    void baza()
      .szablonyAwersowZProjektow(projekt.id)
      .then((lista) => {
        if (aktywny) ustawAwersy(lista);
      })
      .catch(() => undefined);
    return () => {
      aktywny = false;
    };
  }, [projektRewersowy, projekt.id]);

  const dolaczAwers = async (klucz: string) => {
    if (!klucz || trwa) return;
    const wpis = awersy.find((a) => `${a.projektId}:${a.szablonId}` === klucz);
    if (!wpis) return;
    ustawTrwa(true);
    ustawStatus('');
    ustawBlad('');
    try {
      const { projekt: zrodlo, zasoby: zrodloZasoby } = await baza().wczytaj(wpis.projektId);
      const paczka = importujSzablon(eksportujSzablon(zrodlo, zrodloZasoby, wpis.szablonId).bajty);
      // Zachowujemy rewers z bieżącego projektu rewersowego zamiast nadpisywać go rewersem źródła.
      const paczkaBezRewersu = {
        ...paczka,
        szablon: { ...paczka.szablon, rewersId: undefined },
        rewers: undefined,
      };
      await edycja.zmienZZasobami((p, d) => {
        const staryPustyId = p.szablony.length === 1 ? p.szablony[0]!.id : undefined;
        const dodany = dodajSzablon(p, d, paczkaBezRewersu);
        const nowySzablon = dodany.projekt.szablony.find((s) => s.id === dodany.szablonId)!;
        const szablony = staryPustyId
          ? dodany.projekt.szablony.filter((s) => s.id !== staryPustyId)
          : dodany.projekt.szablony;
        const talie = dodany.projekt.talie.map((tl) => {
          const zaktualizowane = tl.karty.map((k) =>
            k.szablonId === staryPustyId ? { ...k, szablonId: dodany.szablonId } : k,
          );
          if (zaktualizowane.length === 0) {
            return {
              ...tl,
              karty: [{ id: crypto.randomUUID(), szablonId: dodany.szablonId, dane: {}, ilosc: 1 }],
            };
          }
          return { ...tl, karty: zaktualizowane };
        });
        const slot = slotSzablonu(nowySzablon);
        const arkusze = dodany.projekt.arkusze.map((a) => ({
          ...a,
          ustawienia: { ...a.ustawienia, slot },
        }));
        return {
          projekt: {
            ...dodany.projekt,
            szablony,
            talie,
            arkusze,
          },
          dane: dodany.zasoby,
        };
      });
      ustawStatus(t('kartka.dolaczonoAwers', { nazwa: wpis.szablonNazwa }));
    } catch (e) {
      ustawBlad(e instanceof Error ? e.message : String(e));
    } finally {
      ustawTrwa(false);
    }
  };

  const rewersyLista = projekt.rewersy ?? [];
  const rewersTalii =
    talia && typeof talia.rewersId === 'string'
      ? rewersyLista.find((r) => r.id === talia.rewersId)
      : undefined;

  return (
    <div className="panel-rewers-awers">
      {projektRewersowy && (
        <div className="pole-panelu">
          <label htmlFor={idAwersu}>{t('kartka.wybierzAwers')}</label>
          {awersy.length === 0 ? (
            <p className="podpis">{t('kartka.brakAwersow')}</p>
          ) : (
            <select
              id={idAwersu}
              aria-label={t('kartka.wybierzAwers')}
              value=""
              disabled={trwa}
              onChange={(e) => void dolaczAwers(e.target.value)}
            >
              <option value="">{t('kartka.wybierzAwersOpcja')}</option>
              {awersy.map((a) => {
                const klucz = `${a.projektId}:${a.szablonId}`;
                const etykieta =
                  a.projektNazwa === a.szablonNazwa
                    ? a.projektNazwa
                    : `${a.projektNazwa} — ${a.szablonNazwa}`;
                return (
                  <option key={klucz} value={klucz}>
                    {etykieta}
                  </option>
                );
              })}
            </select>
          )}
        </div>
      )}
      {status && (
        <p role="status" className="podpis">
          {status}
        </p>
      )}
      {blad && (
        <p role="alert" className="uwaga">
          {blad}
        </p>
      )}
      {talia && (
        <div className="pole-panelu">
          <label htmlFor={idRewersu}>{t('kartka.rewersWszystkich')}</label>
          <select
            id={idRewersu}
            aria-label={t('kartka.rewersWszystkich')}
            value={typeof talia.rewersId === 'string' ? talia.rewersId : ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v.startsWith(PRZEDROSTEK_OPCJI_GLOBALNEJ)) {
                const klucz = v.slice(PRZEDROSTEK_OPCJI_GLOBALNEJ.length);
                const wpis = rewersyGlobalne.find((w) => w.klucz === klucz);
                if (wpis) {
                  void dolaczRewersGlobalnyDoProjektu(wpis, edycja, (p, rid) =>
                    przypiszRewers(p, { rodzaj: 'talia', id: talia.id }, rid),
                  ).catch(() => undefined);
                }
                return;
              }
              zmien((p) => przypiszRewers(p, { rodzaj: 'talia', id: talia.id }, v || undefined));
            }}
          >
            <option value="">{t('rewers.bezRewersu')}</option>
            {rewersyLista.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nazwa}
              </option>
            ))}
            {rewersyGlobalne.length > 0 && (
              <optgroup label={t('rewersy.globalneGrupa')}>
                {rewersyGlobalne.map((w) => (
                  <option key={w.klucz} value={`${PRZEDROSTEK_OPCJI_GLOBALNEJ}${w.klucz}`}>
                    {w.nazwa}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {rewersTalii && (
            <PodgladRewersu
              rewers={rewersTalii}
              zasoby={edycja.zasoby.zasoby}
              komunikatBraku={t('rewers.rozstrzygnietyBrak')}
            />
          )}
        </div>
      )}
    </div>
  );
}
