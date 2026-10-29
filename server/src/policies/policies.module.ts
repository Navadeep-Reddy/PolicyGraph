import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { PoliciesController } from './policies.controller.js';
import { VersionsController } from './versions.controller.js';
import { PoliciesService } from './policies.service.js';
import { PdfDocumentService } from './pdf-document.service.js';
import { PolicyImportService } from './policy-import.service.js';

@Module({
  imports: [AiModule],
  controllers: [PoliciesController, VersionsController],
  providers: [PoliciesService, PdfDocumentService, PolicyImportService],
})
export class PoliciesModule {}
