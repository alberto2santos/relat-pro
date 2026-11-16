export const neutralizeSpreadsheetFormula = (value: string): string =>
  /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
