import { t } from '../../i18n';
import { czyKontener, type Wezel } from '../../model/szablon';

export const IKONY_WEZLOW: Record<Wezel['typ'], string> = {
  wiersz: '⇆',
  kolumna: '⇅',
  warstwy: '⧉',
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
  const wiersz = (w: Wezel, poziom: number): React.ReactNode => {
    const wybrany = zaznaczone.includes(w.id);
    const kontener = czyKontener(w);
    return (
      <li
        key={w.id}
        role="treeitem"
        aria-level={poziom}
        aria-selected={wybrany}
        aria-label={`${nazwaWezla(w)} – ${t(`wezel.${w.typ}`)}`}
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
        </span>
        {kontener && w.dzieci.length > 0 && (
          <ul role="group">{w.dzieci.map((d) => wiersz(d, poziom + 1))}</ul>
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
