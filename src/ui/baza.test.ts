/// <reference types="node" />
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRZYKLADY } from '../przyklady';
import { baza, nowyProjektZPrzykladu } from './baza';

beforeEach(() => {
  vi.stubGlobal('fetch', async (adres: string) => {
    const bajty = readFileSync(`public/czcionki/${adres.split('/czcionki/')[1]}`);
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        bajty.buffer.slice(bajty.byteOffset, bajty.byteOffset + bajty.byteLength),
    };
  });
});

describe('nowyProjektZPrzykladu (baza)', () => {
  it('zapisuje projekt z szablonem i jedną kartą z danymi przykładowymi', async () => {
    const przyklad = await PRZYKLADY[0]!.laduj();
    const id = await nowyProjektZPrzykladu(przyklad);
    const { projekt } = await baza().wczytaj(id);
    expect(projekt.szablony).toHaveLength(1);
    expect(projekt.talie[0]!.karty).toHaveLength(1);
    expect(projekt.talie[0]!.karty[0]!.dane).toEqual(przyklad.dane);
  });

  it('dwa wywołania dają dwa różne projekty', async () => {
    const przyklad = await PRZYKLADY[1]!.laduj();
    const a = await nowyProjektZPrzykladu(przyklad);
    const b = await nowyProjektZPrzykladu(przyklad);
    expect(a).not.toBe(b);
  });
});
