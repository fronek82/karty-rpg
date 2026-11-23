import { t } from '../../i18n';
import type { Postrzepienie, Szkic } from '../../model/szablon';
import { Liczba, Lista, Sekcja, Wybor } from './Kontrolki';

type Opcje = readonly { wartosc: string; tekst: string }[];

export function PoleSzkicu({
  wartosc,
  zmien,
}: {
  wartosc?: Szkic;
  zmien: (v: Szkic | undefined) => void;
}) {
  return (
    <Sekcja tytul={t('dekoracje.szkic')}>
      <Wybor
        etykieta={t('dekoracje.szkic')}
        wartosc={!!wartosc}
        zmien={(v) => zmien(v ? { sila: 0.35, ziarno: 1 } : undefined)}
      />
      {wartosc && (
        <>
          <Liczba
            etykieta={t('dekoracje.sila')}
            wartosc={wartosc.sila}
            max={3}
            krok={0.05}
            zmien={(sila) => zmien({ ...wartosc, sila })}
          />
          <Liczba
            etykieta={t('dekoracje.ziarno')}
            wartosc={wartosc.ziarno}
            max={4294967295}
            zmien={(v) => zmien({ ...wartosc, ziarno: Math.round(v) })}
          />
        </>
      )}
    </Sekcja>
  );
}

export function TloDekoracyjne({
  tekstura,
  postrzepienie,
  obrazy,
  zmienTeksture,
  zmienPostrzepienie,
}: {
  tekstura?: string;
  postrzepienie?: Postrzepienie;
  obrazy: Opcje;
  zmienTeksture: (v: string | undefined) => void;
  zmienPostrzepienie: (v: Postrzepienie | undefined) => void;
}) {
  const opcje = [{ wartosc: '', tekst: t('dekoracje.brakTekstury') }, ...obrazy];
  if (tekstura && !opcje.some((o) => o.wartosc === tekstura))
    opcje.push({ wartosc: tekstura, tekst: t('dekoracje.brakZasobu', { id: tekstura }) });
  return (
    <Sekcja tytul={t('dekoracje.tlo')}>
      <Lista
        etykieta={t('dekoracje.tekstura')}
        opcje={opcje}
        wartosc={tekstura ?? ''}
        zmien={(v) => zmienTeksture(v || undefined)}
      />
      {obrazy.length === 0 && <p className="podpis">{t('dekoracje.obrazy')}</p>}
      <PolePostrzepienia wartosc={postrzepienie} zmien={zmienPostrzepienie} />
    </Sekcja>
  );
}

/** Postrzępiona krawędź (karta albo kontener): włącznik i parametry. */
export function PolePostrzepienia({
  wartosc,
  zmien,
}: {
  wartosc: Postrzepienie | undefined;
  zmien: (v: Postrzepienie | undefined) => void;
}) {
  return (
    <>
      <Wybor
        etykieta={t('dekoracje.postrzepienie')}
        wartosc={!!wartosc}
        zmien={(v) => zmien(v ? { sila: 0.8, ziarnistosc: 2.5, ziarno: 1 } : undefined)}
      />
      {wartosc && (
        <>
          <Liczba
            etykieta={t('dekoracje.sila')}
            wartosc={wartosc.sila}
            max={3}
            krok={0.05}
            zmien={(sila) => zmien({ ...wartosc, sila })}
          />
          <Liczba
            etykieta={t('dekoracje.ziarnistosc')}
            wartosc={wartosc.ziarnistosc}
            min={0.5}
            max={30}
            krok={0.5}
            zmien={(ziarnistosc) => zmien({ ...wartosc, ziarnistosc })}
          />
          <Liczba
            etykieta={t('dekoracje.ziarno')}
            wartosc={wartosc.ziarno}
            max={4294967295}
            zmien={(v) => zmien({ ...wartosc, ziarno: Math.round(v) })}
          />
        </>
      )}
    </>
  );
}
