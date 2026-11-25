import { useId, useState } from 'react';
import { dodajSzablon } from '../../dane/archiwum';
import { czyProjektRewersowy } from '../../dane/baza';
import { dodajPierwszaKarteTalii } from '../../dane/kartka';
import { przypiszRewers } from '../../dane/rewers';
import { slotSzablonu } from '../../dane/wlasneKarty';
import { t } from '../../i18n';
import { kluczTresciSzablonu, type Talia } from '../../model/szablon';
import {
  etykietaAwersuZProjektu,
  kluczAwersuZProjektu,
  useAwersyZProjektow,
  wczytajPaczkeAwersuBezRewersu,
} from '../awersyZProjektow';
import { PodgladRewersu } from '../rewers/PodgladRewersu';
import { przodyDoPrzypisania, useZgodnoscTylu } from '../zgodnoscTylu';
import { dolaczRewersGlobalnyDoProjektu, useRewersyGlobalne } from '../rewersyGlobalne';
import type { ProjektWEdycji } from '../useProjekt';
import {
  atrybutyZrodla,
  OpcjeRewersowGlobalnych,
  wybranaOpcja,
  type ZrodloOpcji,
} from '../zrodloOpcji';

/**
 * Sekcja w prawym panelu Edytora kart (gdy żadna karta nie jest zaznaczona):
 * - wybór awersu dla wszystkich kart w talii (z bieżącego i wszystkich innych projektów);
 * - wybór rewersu dla wszystkich kart w talii (z bieżącego i wszystkich innych projektów).
 */
export function PanelRewersuIAwersu({
  edycja,
  talia,
  bezRewersu = false,
}: {
  edycja: ProjektWEdycji;
  talia: Talia | undefined;
  /** Gra z kartami jednostronnymi – bez wyboru rewersu. */
  bezRewersu?: boolean;
}) {
  const { projekt, zmien } = edycja;
  const projektRewersowy = czyProjektRewersowy(projekt);
  const { rewersyGlobalne } = useRewersyGlobalne(projekt);
  const { okno: oknoZgodnosci, potwierdz: potwierdzZgodnosc } = useZgodnoscTylu();
  const awersyInne = useAwersyZProjektow(projekt.id, projekt.szablony);
  const [status, ustawStatus] = useState('');
  const [blad, ustawBlad] = useState('');
  const [trwa, ustawTrwa] = useState(false);
  const idAwersu = useId();
  const idRewersu = useId();

  const unikalneAwersy = new Set((talia?.karty ?? []).map((k) => k.szablonId));
  const kandydatAwersu = unikalneAwersy.size === 1 ? [...unikalneAwersy][0]! : '';
  const lokalneAwersy = (() => {
    const niepuste = projekt.szablony.filter((s) => s.korzen.dzieci.length > 0);
    // Identyczne kopie (ten sam klucz treści) pokazujemy raz; inne o tej samej nazwie – osobno.
    const wgTresci = new Map<string, (typeof niepuste)[number]>();
    for (const s of niepuste) {
      const k = kluczTresciSzablonu(s);
      const obecny = wgTresci.get(k);
      if (!obecny || s.id === kandydatAwersu) wgTresci.set(k, s);
    }
    return [...wgTresci.values()];
  })();
  const lokalneIds = new Set(lokalneAwersy.map((s) => s.id));
  const wspolnyAwersId =
    unikalneAwersy.size > 1 ? '__rozne__' : lokalneIds.has(kandydatAwersu) ? kandydatAwersu : '';

  const ustawAwersDlaWszystkich = async (wartosc: string, zrodlo: ZrodloOpcji = 'projekt') => {
    if (!wartosc || !talia || trwa) return;
    ustawStatus('');
    ustawBlad('');
    if (zrodlo !== 'inny-projekt') {
      const sz = projekt.szablony.find((s) => s.id === wartosc);
      if (!sz) return;
      zmien((p) => {
        if (p.talie.find((tl) => tl.id === talia.id)?.karty.length === 0)
          return dodajPierwszaKarteTalii(p, talia.id, { szablonId: sz.id, dane: {} });
        const talie = p.talie.map((tl) =>
          tl.id !== talia.id
            ? tl
            : { ...tl, karty: tl.karty.map((k) => ({ ...k, szablonId: sz.id })) },
        );
        return { ...p, zmieniono: new Date().toISOString(), talie };
      });
      return;
    }

    const wpis = awersyInne.find((a) => kluczAwersuZProjektu(a) === wartosc);
    if (!wpis) return;
    const istniejacy = projekt.szablony.find(
      (s) => s.korzen.dzieci.length > 0 && kluczTresciSzablonu(s) === wpis.kluczTresci,
    );
    if (istniejacy) {
      await ustawAwersDlaWszystkich(istniejacy.id);
      return;
    }
    ustawTrwa(true);
    try {
      const paczkaBezRewersu = await wczytajPaczkeAwersuBezRewersu(wpis);
      await edycja.zmienZZasobami((p, d) => {
        const staryPustyId =
          czyProjektRewersowy(p) && p.szablony.length === 1 ? p.szablony[0]!.id : undefined;
        const dodany = dodajSzablon(p, d, paczkaBezRewersu);
        const nowySzablon = dodany.projekt.szablony.find((s) => s.id === dodany.szablonId)!;
        const szablony = staryPustyId
          ? dodany.projekt.szablony.filter((s) => s.id !== staryPustyId)
          : dodany.projekt.szablony;
        const pusta = dodany.projekt.talie.find((tl) => tl.id === talia.id)?.karty.length === 0;
        const zKarta = pusta
          ? dodajPierwszaKarteTalii(dodany.projekt, talia.id, {
              szablonId: dodany.szablonId,
              dane: {},
            })
          : {
              ...dodany.projekt,
              talie: dodany.projekt.talie.map((tl) =>
                tl.id !== talia.id
                  ? tl
                  : {
                      ...tl,
                      karty: tl.karty.map((k) => ({ ...k, szablonId: dodany.szablonId })),
                    },
              ),
            };
        const arkusze = staryPustyId
          ? zKarta.arkusze.map((a) => ({
              ...a,
              ustawienia: { ...a.ustawienia, slot: slotSzablonu(nowySzablon) },
            }))
          : zKarta.arkusze;
        return {
          projekt: { ...zKarta, szablony, arkusze },
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
      {oknoZgodnosci}
      {talia && (lokalneAwersy.length > 0 || awersyInne.length > 0 || projektRewersowy) && (
        <div className="pole-panelu">
          <label htmlFor={idAwersu}>{t('kartka.awersWszystkich')}</label>
          {lokalneAwersy.length === 0 && awersyInne.length === 0 ? (
            <p className="podpis">{t('kartka.brakAwersow')}</p>
          ) : (
            <select
              id={idAwersu}
              aria-label={t('kartka.awersWszystkich')}
              value={wspolnyAwersId}
              disabled={trwa}
              onChange={(e) => {
                const { id, zrodlo } = wybranaOpcja(e);
                void ustawAwersDlaWszystkich(id, zrodlo);
              }}
            >
              {wspolnyAwersId === '' && <option value="">{t('kartka.wybierzAwersOpcja')}</option>}
              {wspolnyAwersId === '__rozne__' && (
                <option value="__rozne__" disabled>
                  {t('kartka.rozneAwersy')}
                </option>
              )}
              {lokalneAwersy.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nazwa}
                </option>
              ))}
              {awersyInne.length > 0 && (
                <optgroup label={t('kartka.awersyInneProjekty')}>
                  {awersyInne.map((a) => {
                    const klucz = kluczAwersuZProjektu(a);
                    return (
                      <option key={klucz} value={klucz} {...atrybutyZrodla('inny-projekt')}>
                        {etykietaAwersuZProjektu(a)}
                      </option>
                    );
                  })}
                </optgroup>
              )}
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
      {talia && !bezRewersu && (
        <div className="pole-panelu">
          <label htmlFor={idRewersu}>{t('kartka.rewersWszystkich')}</label>
          <select
            id={idRewersu}
            aria-label={t('kartka.rewersWszystkich')}
            value={typeof talia.rewersId === 'string' ? talia.rewersId : ''}
            onChange={(e) => {
              const { id: v, zrodlo } = wybranaOpcja(e);
              const przody = przodyDoPrzypisania(projekt, talia.id);
              if (zrodlo === 'globalny') {
                const wpis = rewersyGlobalne.find((w) => w.klucz === v);
                if (wpis) {
                  void dolaczRewersGlobalnyDoProjektu(
                    wpis,
                    edycja,
                    (p, rid) => przypiszRewers(p, { rodzaj: 'talia', id: talia.id }, rid),
                    (r) => potwierdzZgodnosc(przody, r),
                  ).catch(() => undefined);
                }
                return;
              }
              const r = projekt.rewersy?.find((x) => x.id === v);
              void (r ? potwierdzZgodnosc(przody, r) : Promise.resolve(true)).then(
                (tak) =>
                  tak &&
                  zmien((p) =>
                    przypiszRewers(p, { rodzaj: 'talia', id: talia.id }, v || undefined),
                  ),
              );
            }}
          >
            <option value="">{t('rewers.bezRewersu')}</option>
            {rewersyLista.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nazwa}
              </option>
            ))}
            <OpcjeRewersowGlobalnych lista={rewersyGlobalne} />
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
