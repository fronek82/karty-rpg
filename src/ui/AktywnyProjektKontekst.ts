import { createContext, useContext } from 'react';
import type { ProjektWEdycji } from './useProjekt';

/**
 * Bieżący projekt otwarty w edytorze – udostępniany m.in. górnemu menu „Ustawienia”,
 * żeby okna wgrywania czcionek i obrazów mogły od razu dodać pliki także do aktywnego projektu.
 */
export const AktywnyProjektKontekst = createContext<ProjektWEdycji | undefined>(undefined);

export const useAktywnyProjekt = () => useContext(AktywnyProjektKontekst);
