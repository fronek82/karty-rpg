// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { WybierzStroneSzablonu } from './WybierzStroneSzablonu';

afterEach(cleanup);

describe('WybierzStroneSzablonu', () => {
  it('przód i tył to odnośniki do kreatora; opisy obu stron bez grafik', () => {
    const { container } = render(<WybierzStroneSzablonu />);
    const przod = t('wlasne.awersNazwa');
    const tyl = t('wlasne.rewersNazwa');
    expect(screen.getByRole('link', { name: new RegExp(`^${przod}`) }).getAttribute('href')).toBe(
      '#/wlasne/nowy/awers',
    );
    expect(screen.getByRole('link', { name: new RegExp(`^${tyl}`) }).getAttribute('href')).toBe(
      '#/wlasne/nowy/rewers',
    );
    expect(screen.getByRole('heading', { name: przod, level: 2 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: tyl, level: 2 })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });
});
