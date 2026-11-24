import { useRef } from 'react';
import { t } from '../../i18n';
import { DOMYSLNY_KOLOR_TEKSTU, type Rewers, type TrybTla } from '../../model/szablon';
import { Liczba, Lista, PoleKoloru, Wybor } from './Kontrolki';

/** Wgrywanie obrazu tła tyłu karty z pliku (PNG, JPEG). */
export function WgrywanieTekstury({ wgraj, blad }: { wgraj: (f: File) => void; blad: string }) {
  const plik = useRef<HTMLInputElement>(null);
  return (
    <>
      <div className="wiersz-przyciskow">
        <button type="button" onClick={() => plik.current?.click()}>
          {t('dekoracje.wgrajTeksture')}
        </button>
        <input
          ref={plik}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          data-testid="plik-tekstury-rewersu"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) wgraj(f);
          }}
        />
      </div>
      {blad && (
        <p role="alert" className="blad-pola">
          {blad}
        </p>
      )}
    </>
  );
}

const ulamek = (v: number) => Math.max(0, Math.min(1, Math.round(v) / 100));

/** Tryb dopasowania, krycie i zabarwienie obrazu tła tyłu karty. */
export function DodatkiTeksturyTylu({
  rewers,
  zmien,
}: {
  rewers: Rewers;
  zmien: (f: (r: Rewers) => Rewers, klucz: string) => void;
}) {
  const zabarwienie = rewers.teksturaZabarwienie;
  const zmienZabarwienie = (z: Partial<NonNullable<Rewers['teksturaZabarwienie']>>, k: string) =>
    zmien(
      (r) =>
        r.teksturaZabarwienie
          ? { ...r, teksturaZabarwienie: { ...r.teksturaZabarwienie, ...z } }
          : r,
      k,
    );
  return (
    <>
      <Lista
        etykieta={t('dekoracje.trybTla')}
        opcje={(['wypelnij', 'dopasuj', 'rozciagnij', 'kafelki'] as const).map((m: TrybTla) => ({
          wartosc: m,
          tekst: t(`obraz.${m}`),
        }))}
        wartosc={rewers.teksturaTryb ?? 'wypelnij'}
        zmien={(m) => zmien((r) => ({ ...r, teksturaTryb: m }), 'teksturaTryb')}
      />
      <Liczba
        etykieta={t('dekoracje.krycieTekstury')}
        wartosc={Math.round((rewers.teksturaKrycie ?? 1) * 100)}
        min={0}
        max={100}
        krok={5}
        zmien={(v) =>
          zmien((r) => {
            const k = ulamek(v);
            const x = { ...r };
            if (k >= 1) delete x.teksturaKrycie;
            else x.teksturaKrycie = k;
            return x;
          }, 'teksturaKrycie')
        }
      />
      <Wybor
        etykieta={t('dekoracje.zabarwienie')}
        wartosc={!!zabarwienie}
        zmien={(v) =>
          zmien((r) => {
            const x = { ...r };
            if (v) x.teksturaZabarwienie = { kolor: DOMYSLNY_KOLOR_TEKSTU, krycie: 0.35 };
            else delete x.teksturaZabarwienie;
            return x;
          }, 'teksturaZabarwienie')
        }
      />
      {zabarwienie && (
        <div className="dwa-pola">
          <PoleKoloru
            id="karta-tekstura-zabarwienie-kolor"
            etykieta={t('dekoracje.kolorZabarwienia')}
            wartosc={zabarwienie.kolor}
            moznaBrak={false}
            zmien={(kolor) =>
              kolor !== undefined && zmienZabarwienie({ kolor }, 'teksturaZabarwienieKolor')
            }
          />
          <Liczba
            etykieta={t('dekoracje.silaZabarwienia')}
            wartosc={Math.round(zabarwienie.krycie * 100)}
            min={0}
            max={100}
            krok={5}
            zmien={(v) => zmienZabarwienie({ krycie: ulamek(v) }, 'teksturaZabarwienieSila')}
          />
        </div>
      )}
    </>
  );
}
