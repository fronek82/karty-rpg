import { useRef, useState } from 'react';
import { ROZSZERZENIE_SZABLONU } from '../../dane/archiwum';
import { t } from '../../i18n';
import { nowyProjektZSzablonu } from '../baza';

/**
 * „Stwórz własne karty”: edytor szablonu od zera jest w budowie (M2-3/M2-4); już teraz można
 * zaimportować plik szablonu – powstaje projekt z kartką dopasowaną do rozmiaru karty.
 */
export function WlasneKarty() {
  const plik = useRef<HTMLInputElement>(null);
  const [stan, ustawStan] = useState<{ tworze?: boolean; blad?: string }>({});

  const importuj = async (f: File) => {
    ustawStan({ tworze: true });
    try {
      const id = await nowyProjektZSzablonu(new Uint8Array(await f.arrayBuffer()));
      window.location.hash = `#/projekt/${encodeURIComponent(id)}`;
    } catch (e) {
      ustawStan({
        blad: t('szablony.bladImportu', { szczegoly: e instanceof Error ? e.message : String(e) }),
      });
    }
  };

  return (
    <section className="wlasne-karty">
      <nav aria-label={t('projekt.nawigacja')} className="okruszki">
        <a href="#/">{t('nawigacja.start')}</a> › {t('start.stworzWlasne')}
      </nav>
      <h1>{t('start.wlasneWBudowie')}</h1>
      <p>{t('start.wlasneWBudowieOpis')}</p>
      <h2>{t('start.wlasneZSzablonu')}</h2>
      <p>{t('start.wlasneZSzablonuOpis')}</p>
      <p>
        <button
          type="button"
          className="glowny"
          disabled={stan.tworze}
          onClick={() => plik.current?.click()}
        >
          {stan.tworze ? t('start.tworze') : t('szablony.importuj')}
        </button>
        <input
          ref={plik}
          type="file"
          accept={`${ROZSZERZENIE_SZABLONU},.zip`}
          hidden
          data-testid="plik-szablonu-start"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void importuj(f);
          }}
        />
      </p>
      {stan.blad && (
        <p role="alert" className="uwaga">
          {stan.blad}
        </p>
      )}
      <p>
        <a href="#/">{t('nawigacja.wrocNaStart')}</a>
      </p>
    </section>
  );
}
