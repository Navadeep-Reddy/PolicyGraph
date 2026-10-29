import { HttpStatus, Injectable } from '@nestjs/common';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy, PDFPageProxy, RenderParameters } from 'pdfjs-dist/types/src/display/api.js';
import { ContractHttpException } from '../common/contract-http.exception.js';
import { filterMarginLines, hasUsableText, normalizePdfText, type PdfLine } from './pdf-text.js';
import { QwenOcrService } from '../ai/qwen-ocr.service.js';

export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_PAGES = 100;
const MAX_RENDER_WIDTH = 1600;

function invalid(message: string): never { throw new ContractHttpException('VALIDATION_ERROR', message, HttpStatus.BAD_REQUEST); }

@Injectable()
export class PdfDocumentService {
  constructor(private readonly qwenOcrService: QwenOcrService) {}
  async extract(buffer: Buffer): Promise<{ text: string; pages: number }> {
    if (!buffer.length || buffer.length > MAX_PDF_BYTES) invalid('PDF must be no larger than 15 MiB');
    if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') invalid('Invalid PDF file');
    const loadingTask = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
    let document: PDFDocumentProxy;
    try { document = await loadingTask.promise; }
    catch { return invalid('PDF cannot be opened'); }
    try {
    if (document.numPages > MAX_PDF_PAGES) invalid('PDF cannot exceed 100 pages');
    const linePages: PdfLine[][] = [];
    const pageData: { page: PDFPageProxy }[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number); const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent(); const lines: PdfLine[] = [];
      const fragments: { text: string; x: number; y: number; width: number; hasEOL: boolean }[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        fragments.push({ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width, hasEOL: Boolean(item.hasEOL) });
      }
      fragments.sort((a,b) => Math.abs(a.y-b.y) > 3 ? b.y-a.y : a.x-b.x);
      let current = '', lastY: number | undefined, lastRight = 0;
      for (const fragment of fragments) {
        if (lastY !== undefined && (Math.abs(fragment.y-lastY)>3 || fragment.hasEOL)) { if(current.trim()) lines.push({text:current.trim(),y:lastY,pageHeight:viewport.height}); current=''; }
        else if (current && fragment.x-lastRight > 1 && !/\s$/.test(current) && !/^\s/.test(fragment.text)) current += ' ';
        current += fragment.text; lastY=fragment.y; lastRight=fragment.x+fragment.width;
      }
      if (current.trim() && lastY !== undefined) lines.push({ text: current.trim(), y: lastY, pageHeight: viewport.height });
      linePages.push(lines); pageData.push({ page });
    }
    const filtered = filterMarginLines(linePages);
    const outputs: string[] = [];
    const candidates = pageData.map((_, index) => !hasUsableText(normalizePdfText(filtered[index])));
    for (let index = 0; index < pageData.length; index++) {
      const body = normalizePdfText(filtered[index]);
      if (!candidates[index]) { outputs.push(body); continue; }
      const page = pageData[index].page; const viewport = page.getViewport({ scale: Math.min(2, MAX_RENDER_WIDTH / page.getViewport({ scale: 1 }).width) });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const renderParameters = { canvasContext: canvas.getContext('2d') as unknown as CanvasRenderingContext2D, viewport } as RenderParameters;
      await page.render(renderParameters).promise;
      outputs.push(normalizePdfText(await this.qwenOcrService.transcribe(canvas.toBuffer('image/png'))));
    }
    return { text: outputs.join('\n\n'), pages: document.numPages };
    } finally { await loadingTask.destroy(); }
  }
}
