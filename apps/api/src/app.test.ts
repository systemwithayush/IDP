import request from 'supertest';
import { app } from './app.js';

describe('API Foundation & Health Checks', () => {
  it('GET /health returns 200 OK with timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /ready returns 200 OK with system status', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ready');
    expect(res.body).toHaveProperty('version');
  });

  it('GET /unknown-route returns 404 with standardized error envelope', async () => {
    const res = await request(app).get('/api/v1/non-existent-endpoint');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(res.body.error).toHaveProperty('message');
  });

  it('Response headers include x-correlation-id', async () => {
    const res = await request(app).get('/health');
    expect(res.headers).toHaveProperty('x-correlation-id');
  });
});

