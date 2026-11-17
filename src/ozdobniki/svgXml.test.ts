import { describe, expect, it } from 'vitest';
import { BladXml, LIMITY_XML, parsujXml, rozwinEncje } from './svgXml';

const kod = (s: string) => {
  try {
    parsujXml(s);
  } catch (e) {
    return e instanceof BladXml ? e.kod : 'inny';
  }
  return 'ok';
};

describe('parser XML – bezpieczeństwo', () => {
  it('DOCTYPE z encjami (bomba encji) jest pomijany, encje własne nie są rozwijane', () => {
    const bomba =
      '<!DOCTYPE svg [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">]>';
    const w = parsujXml(`${bomba}<svg x="&c;"><g/></svg>`);
    expect(w.atr.x).toBe('&c;');
    expect(w.dzieci).toHaveLength(1);
  });

  it('nazwy z prototypu Object nie działają jak encje ani klucze', () => {
    expect(rozwinEncje('&constructor;&toString;&__proto__;&hasOwnProperty;')).toBe(
      '&constructor;&toString;&__proto__;&hasOwnProperty;',
    );
    expect(rozwinEncje('&lt;&amp;&#65;&#x42;')).toBe('<&AB');
    const w = parsujXml('<svg __proto__="x" constructor="y" fill="&constructor;"/>');
    expect(Object.getPrototypeOf(w.atr)).toBeNull();
    expect(w.atr.fill).toBe('&constructor;');
    expect(Object.keys(w.atr).sort()).toEqual(['__proto__', 'constructor', 'fill']);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('CDATA i komentarze: treść pomijana (poza style/script), niezamknięte – błąd', () => {
    const w = parsujXml(
      '<svg><!-- <g/> --><![CDATA[<g/>]]><style><![CDATA[a{b:c}]]></style></svg>',
    );
    expect(w.dzieci.map((d) => d.nazwa)).toEqual(['style']);
    expect(w.dzieci[0]!.tekst).toBe('a{b:c}');
    expect(kod('<svg><!-- brak końca</svg>')).toBe('xml');
    expect(kod('<svg><![CDATA[ brak</svg>')).toBe('xml');
    expect(kod('<!DOCTYPE svg [ <svg/>')).toBe('xml');
  });

  it('powtórzony atrybut: wygrywa pierwszy, bez nadpisywania', () => {
    expect(parsujXml('<svg a="1" a="2"/>').atr.a).toBe('1');
  });

  it('głębokość 64 przechodzi, 65 – błąd', () => {
    const otwarte = (n: number) => '<g>'.repeat(n - 1) + '<g/>' + '</g>'.repeat(n - 1);
    expect(kod(`<svg>${otwarte(LIMITY_XML.glebokosc - 1)}</svg>`)).toBe('ok');
    expect(
      kod(`<svg>${'<g>'.repeat(LIMITY_XML.glebokosc)}${'</g>'.repeat(LIMITY_XML.glebokosc)}</svg>`),
    ).toBe('za-gleboko');
  });

  it('20 000 elementów przechodzi, 20 001 – błąd', () => {
    expect(kod(`<svg>${'<g/>'.repeat(LIMITY_XML.elementy - 1)}</svg>`)).toBe('ok');
    expect(kod(`<svg>${'<g/>'.repeat(LIMITY_XML.elementy)}</svg>`)).toBe('za-duzo-elementow');
  });

  it('niepoprawna składnia: niezamknięty znacznik, zły atrybut, śmieci poza korzeniem', () => {
    for (const zle of [
      '<svg',
      '<svg a>',
      '<svg a=b/>',
      '<svg></g>',
      'x<svg/>',
      '<svg/>y',
      '<svg/><svg/>',
      '',
    ]) {
      expect(kod(zle), zle).toBe('xml');
    }
  });

  it('BOM na początku i instrukcja przetwarzania są dozwolone', () => {
    expect(kod('﻿<?xml version="1.0"?><svg/>')).toBe('ok');
  });
});
