import { tJesliJest } from '../i18n';
import type { GotowyUklad, RozmiarTypu, TypKarty } from '../pakiety/typy';

/**
 * Nazwy elementów pakietu dla użytkownika w bieżącym języku. Dane pakietu mają nazwy polskie
 * (wzorzec); tłumaczenia leżą w słowniku pod kluczami `pakiet.<rodzaj>.<id>`, a brak tłumaczenia
 * daje nazwę z danych.
 */
export const nazwaTypu = (typ: Pick<TypKarty, 'id' | 'nazwa'>): string =>
  tJesliJest(`pakiet.typ.${typ.id}`) ?? typ.nazwa;

export const nazwaWariantu = (w: { szablonId: string; nazwa: string }): string =>
  tJesliJest(`pakiet.wariant.${w.szablonId}`) ?? w.nazwa;

export const nazwaRozmiaru = (r: Pick<RozmiarTypu, 'id' | 'nazwa'>): string | undefined =>
  (r.id ? tJesliJest(`pakiet.rozmiar.${r.id}`) : undefined) ?? r.nazwa;

export const nazwaUkladu = (u: Pick<GotowyUklad, 'id' | 'nazwa'>): string =>
  tJesliJest(`pakiet.uklad.${u.id}`) ?? u.nazwa;

/** Nazwa gry w zwrocie „Stwórz karty do …” (w polskim dopełniacz). */
export const nazwaGryDo = (g: { id: string; nazwaDo: string }): string =>
  tJesliJest(`gra.${g.id}.nazwaDo`) ?? g.nazwaDo;

export const atrybucjaPakietu = (p: { id: string; atrybucja: string }): string =>
  tJesliJest(`gra.${p.id}.atrybucja`) ?? p.atrybucja;
