import { useState } from 'react';

/**
 * Pole liczbowe zsynchronizowane z modelem: wpis jest zatwierdzany na bieżąco (gdy poprawny),
 * a po odrzuceniu zmiany, „Cofnij” albo opuszczeniu pola pokazuje znów wartość z modelu.
 */
export function PoleLiczby({
  id,
  etykieta,
  wartosc,
  min,
  max,
  krok = 1,
  zmien,
  poWyjsciu = false,
}: {
  id: string;
  etykieta: string;
  wartosc: number;
  min: number;
  max: number;
  krok?: number;
  zmien: (v: number) => void;
  /** Zatwierdzanie dopiero po opuszczeniu pola albo Enter (np. rozmiar karty z oknem pytania). */
  poWyjsciu?: boolean;
}) {
  const [tekst, ustawTekst] = useState(String(wartosc));
  const [zModelu, ustawZModelu] = useState(wartosc);
  // Wartość w modelu zmieniła się z zewnątrz (Cofnij, odrzucenie) – pole za nią podąża.
  if (zModelu !== wartosc) {
    ustawZModelu(wartosc);
    if (Number(tekst) !== wartosc) ustawTekst(String(wartosc));
  }
  return (
    <label htmlFor={id}>
      {etykieta}
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={krok}
        value={tekst}
        onChange={(e) => {
          ustawTekst(e.target.value);
          const v = e.target.valueAsNumber;
          if (!poWyjsciu && v >= min && v <= max) zmien(v);
        }}
        onKeyDown={(e) => {
          if (poWyjsciu && e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => {
          const v = e.currentTarget.valueAsNumber;
          if (poWyjsciu && v >= min && v <= max && v !== wartosc) zmien(v);
          ustawTekst(String(wartosc));
        }}
      />
    </label>
  );
}
