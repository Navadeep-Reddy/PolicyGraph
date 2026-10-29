import { HttpStatus, Injectable } from '@nestjs/common';
import type { CreatePolicyResponseDto } from './dto.js';
import { PoliciesService } from './policies.service.js';
import { PdfDocumentService, MAX_PDF_BYTES } from './pdf-document.service.js';
import { ContractHttpException } from '../common/contract-http.exception.js';
import { hasUsableText, normalizePdfText } from './pdf-text.js';

@Injectable()
export class PolicyImportService {
  constructor(private readonly pdf: PdfDocumentService, private readonly policies: PoliciesService) {}
  async import(file: Express.Multer.File | undefined, title: string | undefined, description?: string): Promise<CreatePolicyResponseDto> {
    const invalid = (message: string): never => { throw new ContractHttpException('VALIDATION_ERROR', message, HttpStatus.BAD_REQUEST); };
    if (!file) return invalid('PDF file is required');
    if (!Buffer.isBuffer(file.buffer)) return invalid('PDF file is required');
    if (typeof title !== 'string') return invalid('Title is required');
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return invalid('Title is required');
    if (file.size > MAX_PDF_BYTES) invalid('PDF must be no larger than 15 MiB');
    if (title.trim().length > 200) invalid('Title cannot exceed 200 characters');
    if (description !== undefined && (typeof description !== 'string' || description.length > 2000)) invalid('Description cannot exceed 2000 characters');
    if (!file.originalname.toLowerCase().endsWith('.pdf') || file.mimetype !== 'application/pdf') invalid('File must be a PDF');
    const pages = await this.pdf.extract(file.buffer);
    const text = normalizePdfText(pages.text);
    if (!hasUsableText(text)) invalid('PDF contains no meaningful text');
    return this.policies.createPolicy({ title: normalizedTitle, description: description?.trim(), text });
  }
}
