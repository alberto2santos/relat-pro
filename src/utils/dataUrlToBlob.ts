export function dataUrlToBlob(dataUrl: string): Blob {
  const separatorIndex = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || separatorIndex === -1) {
    throw new Error('Os dados da assinatura local estão inválidos. Reabra a assinatura antes de sincronizar.');
  }

  const metadata = dataUrl.slice(5, separatorIndex);
  const content = dataUrl.slice(separatorIndex + 1);
  const isBase64 = /;base64(?:;|$)/i.test(metadata);
  const mimeType = metadata.split(';')[0] || 'text/plain';

  try {
    if (isBase64) {
      const binary = atob(content.replace(/\s/g, ''));
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new Blob([bytes], { type: mimeType });
    }

    return new Blob([decodeURIComponent(content)], { type: mimeType });
  } catch {
    throw new Error('Não foi possível decodificar a assinatura salva neste dispositivo.');
  }
}
