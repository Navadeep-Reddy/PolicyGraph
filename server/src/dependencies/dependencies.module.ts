import { Module } from '@nestjs/common';
import { DependenciesController } from './dependencies.controller.js';
import { DependenciesService } from './dependencies.service.js';
import { AiModule } from '../ai/ai.module.js';

@Module({ imports: [AiModule], controllers: [DependenciesController], providers: [DependenciesService] })
export class DependenciesModule {}
