import request from 'supertest';
import { app } from '../../app.js';
import { openApiSpec } from './docs.routes.js';

describe('OpenAPI & Swagger Documentation Routes', () => {
  it('GET /docs returns HTML interactive Swagger UI', async () => {
    const res = await request(app).get('/docs');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('SwaggerUIBundle');
    expect(res.text).toContain('IDP API Documentation');
  });

  it('GET /docs/openapi.json returns valid OpenAPI 3.0 specification', async () => {
    const res = await request(app).get('/docs/openapi.json');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.info.title).toContain('Internal Developer Platform');
    expect(res.body.paths).toHaveProperty('/auth/login');
    expect(res.body.paths).toHaveProperty('/services');
    expect(res.body.paths).toHaveProperty('/deployments');
  });

  it('verifies spec structure matches defined endpoints and security schemes', () => {
    expect(openApiSpec.components.securitySchemes).toHaveProperty('BearerAuth');
    expect(openApiSpec.paths['/deployments/{id}/apply']).toBeDefined();
    expect(openApiSpec.paths['/deployments/{id}/rollback']).toBeDefined();
  });
});
