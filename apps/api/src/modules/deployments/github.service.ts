import crypto from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export class GitHubService {
  /**
   * Verifies HMAC SHA-256 signature from GitHub webhook header (x-hub-signature-256).
   * Uses crypto.timingSafeEqual to prevent timing attacks.
   */
  verifyWebhookSignature(payload: string, headerSignature?: string): boolean {
    if (!headerSignature || !headerSignature.startsWith('sha256=')) {
      return false;
    }

    const signature = headerSignature.replace('sha256=', '');
    const hmac = crypto.createHmac('sha256', env.GITHUB_WEBHOOK_SECRET);
    hmac.update(payload);
    const digest = hmac.digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(digest, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Dispatches GitHub Action workflow_dispatch event.
   * If GITHUB_TOKEN is not configured or in test mode, safely falls back to a simulated dispatch.
   */
  async triggerWorkflowDispatch(params: {
    owner: string;
    repo: string;
    workflowId?: string;
    correlationId: string;
    imageTag: string;
    environment: string;
  }): Promise<{ status: 'dispatched' | 'simulated'; runId?: string }> {
    const workflow = params.workflowId || 'deploy.yml';
    const token = env.GITHUB_TOKEN;

    if (!token || env.NODE_ENV === 'test') {
      logger.info(
        { correlationId: params.correlationId, target: `${params.owner}/${params.repo}` },
        'Simulating GitHub Actions workflow_dispatch (offline/test mode)'
      );
      return { status: 'simulated' };
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${params.owner}/${params.repo}/actions/workflows/${workflow}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: 'main',
            inputs: {
              correlation_id: params.correlationId,
              image_tag: params.imageTag,
              environment: params.environment,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub workflow_dispatch failed with status ${response.status}: ${errorText}`);
      }

      logger.info({ correlationId: params.correlationId }, 'GitHub Actions workflow_dispatch triggered');
      return { status: 'dispatched' };
    } catch (err) {
      logger.error({ err, correlationId: params.correlationId }, 'Failed to trigger workflow_dispatch');
      throw err;
    }
  }
}

export const gitHubService = new GitHubService();
