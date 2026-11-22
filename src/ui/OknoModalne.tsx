import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';

const FOKUSOWALNE =
  'a[href], button:not(:disabled), input:not(:disabled):not([hidden]), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Wspólne okno modalne otwierane z menu Ustawienia: renderowane w portalu `document.body`,
 * z pułapką fokusu (`Tab`/`Shift+Tab`) i zamykaniem klawiszem `Escape` lub kliknięciem tła.
 */
export function OknoModalne({
  tytul,
  zamknij,
  children,
}: {
  tytul: string;
  zamknij: () => void;
  children: ReactNode;
}) {
  const idTytulu = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const przyciskZamknij = useRef<HTMLButtonElement>(null);
  const zamknijRef = useRef(zamknij);
  useEffect(() => {
    zamknijRef.current = zamknij;
  });

  // Fokus początkowy wyłącznie przy otwarciu okna (bez kradzieży fokusu przy przerysowaniach).
  useEffect(() => {
    przyciskZamknij.current?.focus();
  }, []);

  // Escape zamyka okno (bez propagacji do edytora), a Tab / Shift+Tab trzyma fokus wewnątrz dialogu.
  useEffect(() => {
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        zamknijRef.current();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const elementy = [...dialogRef.current.querySelectorAll<HTMLElement>(FOKUSOWALNE)].filter(
          (el) => !el.hidden && el.offsetParent !== null,
        );
        if (elementy.length === 0) return;
        const pierwszy = elementy[0]!;
        const ostatni = elementy[elementy.length - 1]!;
        const aktywny = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (!aktywny || aktywny === pierwszy || !dialogRef.current.contains(aktywny)) {
            e.preventDefault();
            ostatni.focus();
          }
        } else if (!aktywny || aktywny === ostatni || !dialogRef.current.contains(aktywny)) {
          e.preventDefault();
          pierwszy.focus();
        }
      }
    };
    window.addEventListener('keydown', klawisz, true);
    return () => window.removeEventListener('keydown', klawisz, true);
  }, []);

  return createPortal(
    <div
      className="okno-zasobow-tlo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) zamknijRef.current();
      }}
    >
      <div
        ref={dialogRef}
        className="okno-zasobow"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTytulu}
      >
        <div className="okno-zasobow-naglowek">
          <h2 id={idTytulu}>{tytul}</h2>
          <button
            ref={przyciskZamknij}
            type="button"
            className="zamknij"
            aria-label={t('zasobyOkno.zamknij')}
            onClick={() => zamknijRef.current()}
          >
            ✕
          </button>
        </div>
        <div className="okno-zasobow-tresc">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
