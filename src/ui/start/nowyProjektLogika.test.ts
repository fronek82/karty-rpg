import { describe, expect, it } from 'vitest';
import {
  czyMoznaUtworzyc,
  FORMATY_NOWEGO_PROJEKTU,
  ikonaDlaOrientacji,
  kluczPodpowiedziDolnej,
  przelaczStrone,
  wymiaryDlaOrientacji,
} from './nowyProjektLogika';

describe('nowyProjektLogika (UI2 R3)', () => {
  it('zamienia wymiary przy przełączeniu orientacji Pionowo ↔ Poziomo (D4)', () => {
    expect(wymiaryDlaOrientacji(63, 88, 'pion')).toEqual({ szer: 63, wys: 88 });
    expect(wymiaryDlaOrientacji(63, 88, 'poziom')).toEqual({ szer: 88, wys: 63 });
    expect(wymiaryDlaOrientacji(88, 63, 'pion')).toEqual({ szer: 63, wys: 88 });
    // Kwadrat zostaje kwadratem.
    expect(wymiaryDlaOrientacji(70, 70, 'poziom')).toEqual({ szer: 70, wys: 70 });

    const poker = FORMATY_NOWEGO_PROJEKTU[0]!;
    expect(ikonaDlaOrientacji(poker, 'pion')).toEqual({ szer: 24, wys: 34 });
    expect(ikonaDlaOrientacji(poker, 'poziom')).toEqual({ szer: 34, wys: 24 });
  });

  it('wymusza co najmniej jedną stronę i dopuszcza sam tył (D5)', () => {
    const tylkoPrzod = { przod: true, tyl: false };
    // Nie pozwala odznaczyć jedynej zaznaczonej strony.
    expect(przelaczStrone(tylkoPrzod, 'przod')).toEqual({ przod: true, tyl: false });

    const obie = przelaczStrone(tylkoPrzod, 'tyl');
    expect(obie).toEqual({ przod: true, tyl: true });

    const tylkoTyl = przelaczStrone(obie, 'przod');
    expect(tylkoTyl).toEqual({ przod: false, tyl: true });

    // Nie pozwala odznaczyć samego tyłu, gdy przód odznaczony.
    expect(przelaczStrone(tylkoTyl, 'tyl')).toEqual({ przod: false, tyl: true });
  });

  it('waliduje możliwość utworzenia projektu w trzech trybach startu', () => {
    expect(
      czyMoznaUtworzyc({
        tryb: 'pusta',
        strony: { przod: true, tyl: false },
        szer: 63,
        wys: 88,
        maPlik: false,
      }),
    ).toBe(true);
    expect(
      czyMoznaUtworzyc({
        tryb: 'pusta',
        strony: { przod: false, tyl: false },
        szer: 63,
        wys: 88,
        maPlik: false,
      }),
    ).toBe(false);
    expect(
      czyMoznaUtworzyc({
        tryb: 'pusta',
        strony: { przod: true, tyl: false },
        szer: 5,
        wys: 88,
        maPlik: false,
      }),
    ).toBe(false);
    expect(
      czyMoznaUtworzyc({
        tryb: 'szablon',
        strony: { przod: true, tyl: false },
        szer: 63,
        wys: 88,
        wybranySzablon: undefined,
        maPlik: false,
      }),
    ).toBe(false);
    expect(
      czyMoznaUtworzyc({
        tryb: 'szablon',
        strony: { przod: true, tyl: false },
        szer: 63,
        wys: 88,
        wybranySzablon: 'a:p1:s1',
        maPlik: false,
      }),
    ).toBe(true);
    expect(
      czyMoznaUtworzyc({
        tryb: 'import',
        strony: { przod: true, tyl: false },
        szer: 63,
        wys: 88,
        maPlik: false,
      }),
    ).toBe(false);
    expect(
      czyMoznaUtworzyc({
        tryb: 'import',
        strony: { przod: true, tyl: false },
        szer: 63,
        wys: 88,
        maPlik: true,
      }),
    ).toBe(true);
  });

  it('dobiera właściwy dopisek na dole okna dla każdej kombinacji', () => {
    expect(kluczPodpowiedziDolnej('pusta', { przod: true, tyl: false })).toBe(
      'nowyProjekt.podpowiedz.przod',
    );
    expect(kluczPodpowiedziDolnej('pusta', { przod: false, tyl: true })).toBe(
      'nowyProjekt.podpowiedz.tyl',
    );
    expect(kluczPodpowiedziDolnej('pusta', { przod: true, tyl: true })).toBe(
      'nowyProjekt.podpowiedz.obie',
    );
    expect(kluczPodpowiedziDolnej('szablon', { przod: true, tyl: false })).toBe(
      'nowyProjekt.podpowiedz.szablon',
    );
    expect(kluczPodpowiedziDolnej('import', { przod: true, tyl: false })).toBe(
      'nowyProjekt.podpowiedz.import',
    );
  });
});
