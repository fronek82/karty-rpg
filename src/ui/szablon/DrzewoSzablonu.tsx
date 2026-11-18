import { formatujLiczbe, t } from '../../i18n';
import { czyKontener, type Kontener, type Wezel } from '../../model/szablon';

const opisPolozenia = (p: NonNullable<Wezel['pozycja']>) =>
  t('polozenie.opisWDrzewie', {
    x: liczba(p.x),
    y: liczba(p.y),
    kotwica: t(`polozenie.kotwica.${p.kotwica ?? 'lewy-gorny'}`),
  }) + (p.obrot ? `, ${t('polozenie.znacznikObrot', { kat: p.obrot })}` : '');

const liczba = (v: number) => formatujLiczbe(v, 1);

export const IKONY_WEZLOW: Record<Wezel['typ'], string> = {
  wiersz: '⇆',
  kolumna: '⇅',
  warstwy: '⧉',
  swobodny: '✥',
  tekst: 'T',
  wartosc: '◇',
  obraz: '▣',
  znaczniki: '○',
  wpis: '▭',
  ikona: '★',
  separator: '—',
  tabela: '▦',
};

/** Nazwa węzła w drzewie: nadana przez użytkownika albo rodzaj elementu. */
export const nazwaWezla = (w: Wezel) => w.nazwa || t(`wezel.${w.typ}`);

/**
 * Drzewo szablonu (ARIA tree): klik zaznacza, Shift+klik dokłada do zaznaczenia; strzałki
 * w górę/w dół przechodzą między elementami (obsługa w edytorze).
 */
export function DrzewoSzablonu({
  korzen,
  zaznaczone,
  wybierz,
}: {
  korzen: Wezel;
  zaznaczone: readonly string[];
  wybierz: (id: string, dodaj: boolean) => void;
}) {
  const wiersz = (w: Wezel, poziom: number, rodzic?: Kontener): React.ReactNode => {
    const wybrany = zaznaczone.includes(w.id);
    const kontener = czyKontener(w);
    // Położenie dziecka kontenera swobodnego: X · Y (mm) i obrót.
    const poz = rodzic?.typ === 'swobodny' ? (w.pozycja ?? { x: 0, y: 0 }) : undefined;
    return (
      <li
        key={w.id}
        role="treeitem"
        aria-level={poziom}
        aria-selected={wybrany}
        aria-label={`${nazwaWezla(w)} – ${t(`wezel.${w.typ}`)}${poz ? `, ${opisPolozenia(poz)}` : ''}`}
        data-wezel={w.id}
        // Jeden przystanek Tab: pierwszy zaznaczony element, bez zaznaczenia – korzeń.
        tabIndex={(zaznaczone.length ? zaznaczone[0] === w.id : poziom === 1) ? 0 : -1}
        className={`wezel-drzewa${wybrany ? ' wybrany' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          wybierz(w.id, e.shiftKey);
        }}
      >
        <span className="wezel-etykieta" style={{ paddingLeft: `${(poziom - 1) * 1.1}rem` }}>
          <span className="ikona-wezla" aria-hidden="true">
            {IKONY_WEZLOW[w.typ]}
          </span>
          {nazwaWezla(w)}
          {w.nazwa && <span className="podpis"> · {t(`wezel.${w.typ}`)}</span>}
          {poz && (
            <span
              className="znacznik-polozenia"
              title={t(`polozenie.kotwica.${poz.kotwica ?? 'lewy-gorny'}`)}
            >
              {t('polozenie.znacznik', { x: liczba(poz.x), y: liczba(poz.y) })}
              {poz.obrot ? (
                <span title={t('polozenie.znacznikObrot', { kat: poz.obrot })}>
                  {' '}
                  {t('polozenie.znacznikObrotKrotki', { kat: poz.obrot })}
                </span>
              ) : null}
            </span>
          )}
        </span>
        {kontener && w.dzieci.length > 0 && (
          <ul role="group">{w.dzieci.map((d) => wiersz(d, poziom + 1, w))}</ul>
        )}
      </li>
    );
  };
  return (
    <ul
      role="tree"
      aria-label={t('szablon.struktura')}
      aria-multiselectable="true"
      className="drzewo-szablonu"
    >
      {wiersz(korzen, 1)}
    </ul>
  );
}
