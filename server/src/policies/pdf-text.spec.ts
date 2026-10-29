import { describe, expect, it } from 'vitest';
import { filterMarginLines, hasUsableText, normalizePdfText } from './pdf-text.js';

describe('PDF text quality', () => {
  it('normalizes line endings, ligatures, hyphenation and whitespace', () => {
    expect(normalizePdfText('A\r\nﬁle hy-\nphen')).toBe('A\nfile hyphen');
  });
  it('accepts meaningful text and rejects short or replacement-heavy text', () => {
    expect(hasUsableText('Hospital policy requires staff to follow all posted procedures.')).toBe(true);
    expect(hasUsableText('short')).toBe(false);
    expect(hasUsableText('\ufffd'.repeat(50))).toBe(false);
  });
  it('filters repeated margin text and page numbers across pages', () => {
    const pages = [1, 2, 3].map((n) => [
      { text: 'Hospital Policy', y: 5, pageHeight: 100 },
      { text: String(n), y: 95, pageHeight: 100 },
      { text: `Body ${n}`, y: 50, pageHeight: 100 },
    ]);
    expect(filterMarginLines(pages)).toEqual(['Body 1', 'Body 2', 'Body 3']);
  });
});
