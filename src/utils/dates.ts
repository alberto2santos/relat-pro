/**
 * Data local no formato AAAA-MM-DD. `toISOString()` usa UTC e, no Brasil, já vira o dia seguinte
 * depois das 21h; para "hoje" na obra (nomes de arquivo, clima do dia), use esta função.
 */
export const localDateISO = (date: Date = new Date()): string =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
