import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createCanvas, loadImage, PDFDocument } from '@napi-rs/canvas';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../..');
const sampleDirectory = resolve(repositoryRoot, 'samples/policy-pdfs');
const sourceDirectory = resolve(sampleDirectory, 'source');

const documents = [
  {
    source: 'visitor-access-compact-v1.md',
    output: 'visitor-access-compact-v1.pdf',
    label: 'HVA-COMPACT | VERSION 1.0',
    scanned: false,
  },
  {
    source: 'visitor-access-compact-v2.md',
    output: 'visitor-access-compact-v2.pdf',
    label: 'HVA-COMPACT | VERSION 2.0',
    scanned: false,
  },
  {
    source: 'hospital-visitor-access-v1.md',
    output: 'hospital-visitor-access-v1-digital.pdf',
    label: 'HVA-100 | VERSION 1.0',
    scanned: false,
  },
  {
    source: 'hospital-visitor-access-v2.md',
    output: 'hospital-visitor-access-v2-digital.pdf',
    label: 'HVA-100 | VERSION 2.0',
    scanned: false,
  },
  {
    source: 'oxygen-cylinder-control-v1.md',
    output: 'oxygen-cylinder-control-v1-scanned.pdf',
    label: 'FAC-240 | VERSION 1.0',
    scanned: true,
  },
  {
    source: 'oxygen-cylinder-control-v2.md',
    output: 'oxygen-cylinder-control-v2-scanned.pdf',
    label: 'FAC-240 | VERSION 2.0',
    scanned: true,
  },
];

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CONTENT_LEFT = 58;
const CONTENT_WIDTH = 479;
const CONTENT_TOP = 70;
const CONTENT_BOTTOM = 782;

function splitPages(markdown) {
  return markdown
    .split(/\n\s*<!-- PAGE BREAK -->\s*\n/g)
    .map((page) => page.trim())
    .filter(Boolean);
}

function parseBlocks(markdown) {
  return markdown
    .split(/\n\s*\n/g)
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((value) => {
      const heading = /^(#{1,3})\s+(.+)$/.exec(value);
      if (heading) return { type: `heading${heading[1].length}`, text: heading[2] };
      return { type: 'paragraph', text: value };
    });
}

function wrapText(context, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawPage(context, markdown, label, pageNumber, pageCount, scanned) {
  context.fillStyle = scanned ? '#f7f5ef' : '#ffffff';
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  if (scanned) {
    context.strokeStyle = '#d8d4ca';
    context.lineWidth = 0.7;
    context.strokeRect(18, 18, PAGE_WIDTH - 36, PAGE_HEIGHT - 36);
  }

  context.fillStyle = '#5f6770';
  context.font = '8px Arial';
  context.fillText(`CARESYNC OCR TEST DOCUMENT | ${label}`, CONTENT_LEFT, 35);
  context.textAlign = 'right';
  context.fillText(`Controlled test copy | Page ${pageNumber} of ${pageCount}`, PAGE_WIDTH - CONTENT_LEFT, 812);
  context.textAlign = 'left';

  let y = CONTENT_TOP;
  for (const block of parseBlocks(markdown)) {
    let font;
    let color;
    let lineHeight;
    let gapBefore;
    let gapAfter;

    if (block.type === 'heading1') {
      font = 'bold 21px Arial';
      color = '#16324a';
      lineHeight = 25;
      gapBefore = 0;
      gapAfter = 13;
    } else if (block.type === 'heading2') {
      font = 'bold 14px Arial';
      color = '#1e5872';
      lineHeight = 18;
      gapBefore = 8;
      gapAfter = 7;
    } else if (block.type === 'heading3') {
      font = 'bold 10.5px Arial';
      color = '#263746';
      lineHeight = 14;
      gapBefore = 5;
      gapAfter = 4;
    } else {
      font = '9.5px Arial';
      color = '#20272d';
      lineHeight = 14;
      gapBefore = 0;
      gapAfter = 9;
    }

    context.font = font;
    const lines = wrapText(context, block.text, CONTENT_WIDTH);
    const requiredHeight = gapBefore + lines.length * lineHeight + gapAfter;
    if (y + requiredHeight > CONTENT_BOTTOM) {
      throw new Error(`Page ${pageNumber} overflows while rendering: ${block.text}`);
    }

    y += gapBefore;
    context.fillStyle = color;
    for (const line of lines) {
      context.fillText(line, CONTENT_LEFT, y);
      y += lineHeight;
    }
    y += gapAfter;
  }
}

async function buildDocument(document) {
  const markdown = await readFile(resolve(sourceDirectory, document.source), 'utf8');
  const pages = splitPages(markdown);
  const pdf = new PDFDocument({
    title: document.output.replace(/\.pdf$/, ''),
    author: 'CareSync',
    subject: document.scanned ? 'Image-only OCR test policy' : 'Embedded-text import test policy',
    creator: 'CareSync sample policy generator',
  });

  for (const [index, page] of pages.entries()) {
    const pageNumber = index + 1;
    const pdfContext = pdf.beginPage(PAGE_WIDTH, PAGE_HEIGHT);

    if (document.scanned) {
      const scale = 2.25;
      const raster = createCanvas(PAGE_WIDTH * scale, PAGE_HEIGHT * scale);
      const rasterContext = raster.getContext('2d');
      rasterContext.scale(scale, scale);
      drawPage(rasterContext, page, document.label, pageNumber, pages.length, true);
      const image = await loadImage(raster.toBuffer('image/png'));
      pdfContext.drawImage(image, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    } else {
      drawPage(pdfContext, page, document.label, pageNumber, pages.length, false);
    }

    pdf.endPage();
  }

  await writeFile(resolve(sampleDirectory, document.output), pdf.close());
}

await mkdir(sampleDirectory, { recursive: true });
const selected = process.argv.includes('--compact') ? documents.filter(document => document.source.startsWith('visitor-access-compact-')) : documents;
for (const document of selected) await buildDocument(document);
console.log(`Generated ${selected.length} policy PDFs in ${sampleDirectory}`);
