import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PolicyImportService } from './policy-import.service.js';
import type { PdfDocumentService } from './pdf-document.service.js';
import type { PoliciesService } from './policies.service.js';

describe('PolicyImportService', () => {
  const extract = vi.fn();
  const createPolicy = vi.fn();
  let service: PolicyImportService;
  const file = {
    buffer: Buffer.from('not a real PDF'),
    size: 15,
    originalname: 'policy.pdf',
    mimetype: 'application/pdf',
  } as Express.Multer.File;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PolicyImportService(
      { extract } as unknown as PdfDocumentService,
      { createPolicy } as unknown as PoliciesService,
    );
    createPolicy.mockResolvedValue({});
  });

  it('creates a policy from meaningful embedded text without invoking OCR', async () => {
    extract.mockResolvedValue({ text: 'Hospital policy requires staff to follow all posted procedures.', pages: 1 });

    await service.import(file, ' Hospital policy ');

    expect(createPolicy).toHaveBeenCalledWith({
      title: 'Hospital policy',
      description: undefined,
      text: 'Hospital policy requires staff to follow all posted procedures.',
    });
    expect(extract).toHaveBeenCalledWith(file.buffer);
  });

  it('creates a policy from text recovered for OCR-needed pages', async () => {
    extract.mockResolvedValue({ text: 'Scanned policy text recovered by OCR with sufficient meaningful content.', pages: 1 });

    await service.import(file, 'Scanned policy');

    expect(createPolicy).toHaveBeenCalledWith({
      title: 'Scanned policy',
      description: undefined,
      text: 'Scanned policy text recovered by OCR with sufficient meaningful content.',
    });
  });

  it.each([
    ['extraction failure', () => extract.mockRejectedValue(new Error('PDF extraction failed'))],
    ['OCR failure', () => extract.mockRejectedValue(new Error('OCR failed'))],
    ['no meaningful extracted text', () => extract.mockResolvedValue({ text: 'short', pages: 1 })],
  ])('does not create a policy after %s', async (_scenario, configure) => {
    configure();

    await expect(service.import(file, 'Policy')).rejects.toBeDefined();
    expect(createPolicy).not.toHaveBeenCalled();
  });
});
