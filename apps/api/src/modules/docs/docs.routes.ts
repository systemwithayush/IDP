import { Router, Request, Response } from 'express';

export const docsRouter = Router();

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Internal Developer Platform (IDP) API',
    version: '1.0.0',
    description:
      'Developer-grade self-service platform API for managing service catalogues, environments, automated GitHub Actions CI/CD, Kubernetes rollouts, secret storage, audit trails, and AI infrastructure advisory.',
    contact: {
      name: 'IDP Platform Engineering',
      url: 'https://github.com/systemwithayush/IDP',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Primary API Gateway',
    },
  ],
  paths: {
    '/auth/login': {
      post: {
        summary: 'Authenticate with email & password',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Authentication successful. Returns user and JWT access token; sets httpOnly refresh cookie.' },
          401: { description: 'Invalid email or password' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current user profile and team metadata',
        tags: ['Authentication'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Current user profile' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/services': {
      get: {
        summary: 'List services with pagination, stack, and search filters',
        tags: ['Service Catalogue'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Paginated list of services' },
        },
      },
      post: {
        summary: 'Create a new service inside team quota',
        tags: ['Service Catalogue'],
        security: [{ BearerAuth: [] }],
        responses: {
          201: { description: 'Service created successfully' },
          422: { description: 'Quota exceeded' },
        },
      },
    },
    '/deployments': {
      post: {
        summary: 'Trigger a new deployment via GitHub Actions workflow_dispatch',
        tags: ['Deployments'],
        security: [{ BearerAuth: [] }],
        responses: {
          201: { description: 'Deployment requested and dispatched' },
        },
      },
    },
    '/deployments/{id}': {
      get: {
        summary: 'Retrieve deployment details and event timeline',
        tags: ['Deployments'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Deployment status and events' },
          404: { description: 'Deployment not found' },
        },
      },
    },
    '/deployments/{id}/apply': {
      post: {
        summary: 'Apply Kubernetes manifests and watch rollout health',
        tags: ['Deployments'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Rollout passed or rolled back' },
        },
      },
    },
    '/deployments/{id}/rollback': {
      post: {
        summary: 'Trigger rollback to previous successful deployment',
        tags: ['Deployments'],
        security: [{ BearerAuth: [] }],
        responses: {
          201: { description: 'Rollback deployment dispatched' },
        },
      },
    },
    '/webhooks/github': {
      post: {
        summary: 'Ingest GitHub Actions workflow_run webhooks (HMAC-verified)',
        tags: ['Webhooks'],
        responses: {
          200: { description: 'Webhook acknowledged' },
          401: { description: 'Invalid HMAC signature' },
        },
      },
    },
    '/audit-log': {
      get: {
        summary: 'Query immutable security audit log entries',
        tags: ['Audit & Governance'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Paginated audit log entries' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

docsRouter.get('/openapi.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(openApiSpec);
});

docsRouter.get('/', (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>IDP API Documentation</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .topbar { display: none; }
    .swagger-ui .info .title { color: #38bdf8; }
    .swagger-ui .info p, .swagger-ui .info li { color: #94a3b8; }
    .swagger-ui { filter: invert(88%) hue-rotate(180deg); }
    .swagger-ui .opblock { border-radius: 6px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        spec: ${JSON.stringify(openApiSpec)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
      });
    };
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
});
