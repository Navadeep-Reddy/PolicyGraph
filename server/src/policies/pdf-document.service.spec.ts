import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const execute = promisify(execFile);
const serverDirectory = fileURLToPath(new URL('../../', import.meta.url));

describe('PDF native rendering regression', () => {
  it('uses the same native canvas installation for the application and PDF.js', () => {
    const require = createRequire(import.meta.url);
    const pdfRequire = createRequire(require.resolve('pdfjs-dist/package.json'));
    // Passing native image objects between different addon versions can cause
    // SIGSEGV rather than a catchable JavaScript exception.
    expect(pdfRequire.resolve('@napi-rs/canvas')).toBe(require.resolve('@napi-rs/canvas'));
  });

  it('extracts real digital/scanned PDFs repeatedly and survives OCR failure', async () => {
    // Run native rendering in a subprocess so a regression reports its signal
    // instead of taking the Vitest worker down with the segmentation fault.
    const source = `
      import assert from 'node:assert/strict';
      import { readFile } from 'node:fs/promises';
      import { PdfDocumentService } from './src/policies/pdf-document.service.ts';
      import { ContractHttpException } from './src/common/contract-http.exception.ts';
      let ocrCalls = 0;
      let failOcr = false;
      const service = new PdfDocumentService({
        transcribe: async (png) => {
          assert.equal(Buffer.from(png).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
          if (failOcr) throw new ContractHttpException('AI_FAILED', 'OCR transcription failed', 502);
          ocrCalls++;
          return 'OCR page ' + ocrCalls + ': Facilities staff must record the full and empty cylinder inventory.';
        },
      });
      const directory = '../samples/policy-pdfs/';
      for (const version of [1, 2]) {
        const result = await service.extract(await readFile(directory + 'hospital-visitor-access-v' + version + '-digital.pdf'));
        assert.equal(result.pages, 3);
        assert(result.text.includes(version === 1 ? '8:00 p.m.' : '6:00 p.m.'));
        assert.equal(ocrCalls, 0, 'Embedded text must not use OCR');
      }
      const scanned = await readFile(directory + 'oxygen-cylinder-control-v1-scanned.pdf');
      for (const version of [1, 2]) {
        const result = await service.extract(await readFile(directory + 'oxygen-cylinder-control-v' + version + '-scanned.pdf'));
        assert.equal(result.pages, 3);
        const first = version === 1 ? 1 : 4;
        assert(result.text.indexOf('OCR page ' + first) < result.text.indexOf('OCR page ' + (first + 1)));
        globalThis.gc();
      }
      assert.equal(ocrCalls, 6, 'Every image-only page must be rendered for OCR');
      failOcr = true;
      await assert.rejects(service.extract(scanned), error => error.code === 'AI_FAILED' && error.getStatus() === 502);
      const afterFailure = await service.extract(await readFile(directory + 'hospital-visitor-access-v1-digital.pdf'));
      assert.equal(afterFailure.pages, 3);
      globalThis.gc();
      console.log(JSON.stringify({ digitalDocuments: 3, scannedDocuments: 2, renderedOcrPages: ocrCalls, survivedOcrFailure: true }));
    `;
    const { stdout } = await execute(process.execPath, ['--expose-gc', '--import', 'tsx', '--input-type=module', '-e', source], {
      cwd: serverDirectory,
      timeout: 45_000,
    });
    expect(JSON.parse(stdout.trim().split('\n').at(-1)!)).toEqual({
      digitalDocuments: 3, scannedDocuments: 2, renderedOcrPages: 6, survivedOcrFailure: true,
    });
  }, 50_000);
});
