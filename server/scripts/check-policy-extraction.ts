import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { ClauseExtractionService, type ExistingClause } from '../src/ai/clause-extraction.service.js';
import { NvidiaClient } from '../src/ai/nvidia.client.js';
import { PdfDocumentService } from '../src/policies/pdf-document.service.js';
import { QwenOcrService } from '../src/ai/qwen-ocr.service.js';

// Opt-in live-provider regression check. No policies or other database records are written.
const samples = new URL('../../samples/policy-pdfs/', import.meta.url);
const extraction = new ClauseExtractionService(new NvidiaClient());
const pdfExtraction = new PdfDocumentService(new QwenOcrService());
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

async function checkPolicy(name: string, pdfName?: string, existing: ExistingClause[] = []) {
  const markdown = await readFile(new URL(`source/${name}.md`, samples), 'utf8');
  const expected = [...markdown.matchAll(/^### [^\n]+\n\n([^\n]+)/gm)].map((match) => normalize(match[1]));
  if (expected.length !== 5) throw new Error(`Expected five answer-key requirements for ${name}`);
  const text = pdfName
    ? (await pdfExtraction.extract(await readFile(new URL(pdfName, samples)))).text
    : markdown.replace(/<!-- PAGE BREAK -->/g, '').replace(/^#{1,3}\s+/gm, '');
  const clauses = await extraction.extract(text, existing);
  const actual = clauses.map((clause) => normalize(clause.text));
  const missing = expected.filter((rule) => !actual.includes(rule));
  const unexpected = actual.filter((rule) => !expected.includes(rule));
  console.log(JSON.stringify({ policy: name, input: pdfName ?? 'source text (OCR not tested)', extracted: clauses.length, missing, unexpected, titles: clauses.map(({ title }) => title) }, null, 2));
  if (clauses.length !== 5 || missing.length || unexpected.length) throw new Error(`Clause selection or wording regression in ${name}`);
  if (existing.length) {
    for (const [index, clause] of clauses.entries()) {
      if (clause.stableKey !== existing[index]?.stableKey) throw new Error(`Revision key changed for ${clause.title}`);
    }
  }
  return clauses;
}

async function main() {
  const visitor = await checkPolicy('hospital-visitor-access-v1', 'hospital-visitor-access-v1-digital.pdf');
  await checkPolicy('hospital-visitor-access-v2', 'hospital-visitor-access-v2-digital.pdf', visitor);
  const oxygen = await checkPolicy('oxygen-cylinder-control-v1');
  await checkPolicy('oxygen-cylinder-control-v2', undefined, oxygen);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
