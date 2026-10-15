import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PoliciesModule } from './policies/policies.module.js';
import { GraphModule } from './graph/graph.module.js';
import { ImpactModule } from './impact/impact.module.js';
import { AiModule } from './ai/ai.module.js';
import { ItemsModule } from './items/items.module.js';
import { DependenciesModule } from './dependencies/dependencies.module.js';

@Module({
  imports: [PrismaModule, PoliciesModule, GraphModule, ImpactModule, AiModule, ItemsModule, DependenciesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
