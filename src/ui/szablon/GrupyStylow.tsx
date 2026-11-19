import { useState } from 'react';
import {
  przypiszGrupeStylu,
  usunGrupeStylu,
  utworzGrupeStylu,
  zmienGrupeStylu,
} from '../../dane/szablon';
import { t } from '../../i18n';
import {
  znajdzGrupeStylu,
  type PoleZeStylem,
  type StylTekstu,
  type Szablon,
} from '../../model/szablon';
import { Lista, Sekcja } from './Kontrolki';
import { PanelStylu } from './PanelStylu';

type Zmiana = (f: (s: Szablon) => Szablon, klucz?: string) => void;
type Czcionki = readonly { wartosc: string; tekst: string }[];

export function GrupyStylow({
  szablon,
  czcionki,
  zmien,
  pole,
}: {
  szablon: Szablon;
  czcionki: Czcionki;
  zmien: Zmiana;
  pole?: PoleZeStylem;
}) {
  const [wybrana, ustawWybrana] = useState('');
  const id = pole ? pole.grupaStyluId : wybrana;
  const grupa = znajdzGrupeStylu(szablon, id);
  const grupaId = grupa?.id ?? '';
  if (!pole && !szablon.grupyStylow?.length) return null;
  return (
    <Sekcja tytul={t('grupy.tytul')}>
      <Lista
        etykieta={t('grupy.grupa')}
        wartosc={grupaId}
        opcje={[
          { wartosc: '', tekst: t(pole ? 'grupy.lokalny' : 'grupy.wybierz') },
          ...(szablon.grupyStylow ?? []).map((g) => ({ wartosc: g.id, tekst: g.nazwa })),
        ]}
        zmien={(v) => (pole ? zmien((s) => przypiszGrupeStylu(s, pole.id, v)) : ustawWybrana(v))}
      />
      {pole && (
        <button
          type="button"
          className="maly"
          onClick={() => zmien((s) => utworzGrupeStylu(s, pole.id, t('grupy.nowyStyl')))}
        >
          {t('grupy.dodaj')}
        </button>
      )}
      {grupa && (
        <>
          <p className="podpis">{t('grupy.opis')}</p>
          <label className="pole-panelu">
            {t('grupy.nazwa')}
            <input
              key={JSON.stringify([grupa.id, grupa.nazwa])}
              defaultValue={grupa.nazwa}
              onBlur={(e) => {
                const nazwa = e.currentTarget.value.trim() || grupa.nazwa;
                e.currentTarget.value = nazwa;
                if (nazwa !== grupa.nazwa) zmien((s) => zmienGrupeStylu(s, grupa.id, { nazwa }));
              }}
            />
          </label>
          <PanelStylu
            styl={grupa.styl}
            czcionki={czcionki}
            zmien={(f) =>
              zmien(
                (s) => zmienGrupeStylu(s, grupa.id, { styl: (st) => f(st) as StylTekstu }),
                `grupa:${grupa.id}`,
              )
            }
          />
          <button
            type="button"
            className="maly"
            onClick={() => zmien((s) => usunGrupeStylu(s, grupa.id))}
          >
            {t('grupy.usun')}
          </button>
        </>
      )}
    </Sekcja>
  );
}
