/**
 * Jednolity zestaw ikon kreskowych SVG dla UI2 (stroke 1,8–2, bez emoji – sekcja 3.3 planu UI2).
 * Wszystkie ikony dziedziczą kolor z `currentColor` i mają `aria-hidden="true"`.
 */

export function IkonaKreskowa({
  sciezka,
  rozmiar = 20,
  grubosc = 1.8,
  klasa,
}: {
  sciezka: string;
  rozmiar?: number;
  grubosc?: number;
  klasa?: string;
}) {
  return (
    <svg
      width={rozmiar}
      height={rozmiar}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grubosc}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={klasa}
    >
      <path d={sciezka} />
    </svg>
  );
}

/** Wspólna ikona „Cofnij” (ta sama na każdym ekranie – sekcja 3.3). */
export function IkonaCofnij({ rozmiar = 18 }: { rozmiar?: number }) {
  return (
    <svg
      width={rozmiar}
      height={rozmiar}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </svg>
  );
}

/** Wspólna ikona „Ponów” (ta sama na każdym ekranie – sekcja 3.3). */
export function IkonaPonow({ rozmiar = 18 }: { rozmiar?: number }) {
  return (
    <svg
      width={rozmiar}
      height={rozmiar}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0 0 10h3" />
    </svg>
  );
}

/** Ikona zębatki (Ustawienia aplikacji). */
export function IkonaUstawien({ rozmiar = 18 }: { rozmiar?: number }) {
  return (
    <svg
      width={rozmiar}
      height={rozmiar}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3 M12 19v3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M2 12h3 M19 12h3 M4.9 19.1 7 17 M17 7l2.1-2.1" />
    </svg>
  );
}
