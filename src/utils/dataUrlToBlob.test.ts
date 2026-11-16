import { describe, expect, it } from 'vitest';
import { dataUrlToBlob } from './dataUrlToBlob';

describe('dataUrlToBlob', () => {
  it('decodes an offline signature without making a network request', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,iVBORw0KGgo=');

    expect(blob.type).toBe('image/png');
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });

  it('decodes percent-encoded data URLs', async () => {
    const blob = dataUrlToBlob('data:text/plain,Relat%20Pro');

    expect(await blob.text()).toBe('Relat Pro');
  });

  it('rejects invalid data URLs with a user-actionable error', () => {
    expect(() => dataUrlToBlob('not-a-data-url'))
      .toThrow('Os dados da assinatura local estão inválidos');
    expect(() => dataUrlToBlob('data:image/png;base64,%%'))
      .toThrow('Não foi possível decodificar a assinatura');
  });
});
