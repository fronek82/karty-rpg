import type { ReactNode } from 'react';
import { t } from '../../i18n';
import type { ElementOzdobny } from '../../ozdobniki';
import { grupyElementow } from '../useBiblioteka';

/**
 * Elementy siatki wyboru ozdobnika w dwóch podpisanych grupach: „Systemowe” (wbudowane)
 * i „Moja biblioteka” (biblioteka użytkownika). Podpisy zajmują cały wiersz siatki.
 */
export function GrupyOzdobnikow({
  elementy,
  render,
}: {
  elementy: readonly ElementOzdobny[];
  render: (e: ElementOzdobny) => ReactNode;
}) {
  const { systemowe, wlasne } = grupyElementow(elementy);
  return (
    <>
      {systemowe.length > 0 && (
        <span className="grupa-ozdobnikow" data-testid="grupa-systemowe">
          {t('biblioteka.zrodlo.systemowe')}
        </span>
      )}
      {systemowe.map(render)}
      {wlasne.length > 0 && (
        <span className="grupa-ozdobnikow" data-testid="grupa-moja">
          {t('biblioteka.zrodlo.moja')}
        </span>
      )}
      {wlasne.map(render)}
    </>
  );
}
