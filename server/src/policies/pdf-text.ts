export const MIN_MEANINGFUL_CHARACTERS = 40;
export const MIN_PRINTABLE_RATIO = 0.85;
export const MAX_REPLACEMENT_RATIO = 0.02;
export const MARGIN_REPEAT_PAGE_RATIO = 0.6;

export interface PdfLine { text: string; y: number; pageHeight: number }

export function normalizePdfText(input: string): string {
  return input.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/[ﬁﬂ]/g, (c) => c === 'ﬁ' ? 'fi' : 'fl')
    .replace(/[ \t]+/g, ' ').replace(/-\n(?=[a-z])/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function filterMarginLines(pages: PdfLine[][]): string[] {
  const canonical = (text: string) => text.trim().toLowerCase().replace(/\b\d+(?:\s*(?:of|\/)\s*\d+)?\b/g, '#').replace(/\s+/g, ' ');
  const counts = new Map<string, number>();
  for (const page of pages) for (const line of page) {
    if (line.text.trim().length <= 100 && (line.y <= line.pageHeight * .12 || line.y >= line.pageHeight * .88)) {
      const key = canonical(line.text); counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return pages.map((page) => page.filter((line) => {
    const text = line.text.trim();
    const margin = line.y <= line.pageHeight * .12 || line.y >= line.pageHeight * .88;
    const number = /^\d+(?:\s*(?:of|\/)\s*\d+)?$/.test(text);
    const repeated = text.length <= 100 && (counts.get(canonical(text)) ?? 0) >= 3 && (counts.get(canonical(text)) ?? 0) / pages.length >= MARGIN_REPEAT_PAGE_RATIO;
    return !(margin && (number || repeated));
  }).map((line) => line.text).join('\n'));
}

export function hasUsableText(text: string): boolean {
  const chars = [...text];
  if (chars.length < MIN_MEANINGFUL_CHARACTERS) return false;
  const printable = chars.filter((c) => /[\p{L}\p{N}\p{P}\p{Z}]/u.test(c)).length / chars.length;
  const replacements = chars.filter((c) => c === '\ufffd').length / chars.length;
  return printable >= MIN_PRINTABLE_RATIO && replacements <= MAX_REPLACEMENT_RATIO && /[\p{L}\p{N}]{3}/u.test(text);
}
