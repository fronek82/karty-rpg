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
}: {
  id: string;
  etykieta: string;
  wartosc: number;
  min: number;
  max: number;
  krok?: number;
  zmien: (v: number) => void;
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
          if (v >= min && v <= max) zmien(v);
        }}
        onBlur={() => ustawTekst(String(wartosc))}
      />
    </label>
  );
}
