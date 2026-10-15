import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    process.env.CLIENT_URL = 'http://client.example';
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('returns the exact health response', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('returns the validation contract envelope for an invalid DTO', () => {
    return request(app.getHttpServer()).patch('/impact-results/example').send({ invalid: true })
      .expect(400).expect((response) => {
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(typeof response.body.error.message).toBe('string');
      });
  });

  it('returns the not found contract envelope for an unknown route', () => {
    return request(app.getHttpServer()).get('/unknown-route').expect(404)
      .expect({ error: { code: 'NOT_FOUND', message: 'Cannot GET /unknown-route' } });
  });

  it('allows the configured CORS origin', () => {
    return request(app.getHttpServer()).get('/health').set('Origin', 'http://client.example')
      .expect('Access-Control-Allow-Origin', 'http://client.example');
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
