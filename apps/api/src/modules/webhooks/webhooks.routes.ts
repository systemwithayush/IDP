import { Router, Request, Response, NextFunction } from 'express';
import { deploymentsService } from '../deployments/deployments.service.js';
import { gitHubService } from '../deployments/github.service.js';
import { logger } from '../../utils/logger.js';

export const webhooksRouter = Router();

/**
 * POST /api/v1/webhooks/github
 * Ingests workflow_run webhooks from GitHub.
 * Verified with HMAC SHA-256 signature, no JWT required.
 */
webhooksRouter.post('/github', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const rawPayload = JSON.stringify(req.body);

    const isValid = gitHubService.verifyWebhookSignature(rawPayload, signature);
    if (!isValid) {
      logger.warn('Received GitHub webhook with invalid HMAC signature');
      res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'HMAC signature verification failed' } });
      return;
    }

    const event = req.headers['x-github-event'] as string;
    if (event === 'workflow_run') {
      await deploymentsService.handleWebhookRun(req.body);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});
