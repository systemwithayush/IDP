import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';

export interface DeploymentNotificationOptions {
  toEmail: string;
  serviceName: string;
  envType: string;
  imageTag: string;
  deploymentId: string;
  runUrl?: string;
  errorReason?: string;
  webhookUrl?: string;
}

export interface QuotaWarningOptions {
  toEmail: string;
  teamName: string;
  resourceType: 'CPU' | 'Memory' | 'Services';
  percentUsed: number;
  currentUsage: number;
  limit: number;
}

export interface OnboardingEmailOptions {
  toEmail: string;
  role: string;
  teamName: string;
  loginUrl?: string;
}

export class NotificationService {
  private transporter: nodemailer.Transporter | null = null;
  public sentEmails: Array<{ to: string; subject: string; html: string }> = [];
  public sentWebhooks: Array<{ url: string; payload: any }> = [];

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        },
      });
      logger.info('NotificationService initialized with configured SMTP transporter');
    } else {
      // Test / development mock transporter
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      logger.info('NotificationService initialized with local in-memory/JSON transporter');
    }
  }

  public setTransporter(transporter: nodemailer.Transporter) {
    this.transporter = transporter;
  }

  /**
   * Deployment Success Email
   */
  async sendDeploymentSuccess(options: DeploymentNotificationOptions): Promise<void> {
    const { toEmail, serviceName, envType, imageTag, deploymentId } = options;
    const subject = `[IDP] Deployment Succeeded: ${serviceName} (${envType})`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0b0e; color: #f3f4f6; border-radius: 8px; border: 1px solid #1f2937; overflow: hidden;">
        <div style="background: #064e3b; padding: 20px 24px; border-bottom: 1px solid #059669;">
          <h2 style="margin: 0; color: #34d399; font-size: 18px; display: flex; align-items: center; gap: 8px;">
            ✔ Deployment Successful
          </h2>
        </div>
        <div style="padding: 24px;">
          <p style="margin-top: 0; color: #9ca3af;">Service <strong>${serviceName}</strong> has been successfully deployed to environment <strong>${envType}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 120px;">Deployment ID:</td>
              <td style="padding: 8px 0; color: #e5e7eb; font-family: monospace;">${deploymentId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Image Tag:</td>
              <td style="padding: 8px 0; color: #e5e7eb; font-family: monospace;">${imageTag}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Environment:</td>
              <td style="padding: 8px 0; color: #34d399; font-weight: 600; text-transform: uppercase;">${envType}</td>
            </tr>
          </table>
          <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">Automated notification from Internal Developer Platform.</p>
        </div>
      </div>
    `;

    await this.sendMail(toEmail, subject, html);
  }

  /**
   * Deployment Failure Email + Chat Webhook Dispatch
   */
  async sendDeploymentFailure(options: DeploymentNotificationOptions): Promise<void> {
    const { toEmail, serviceName, envType, imageTag, deploymentId, errorReason, webhookUrl } = options;
    const subject = `[IDP ALERT] Deployment Failed: ${serviceName} (${envType})`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0b0e; color: #f3f4f6; border-radius: 8px; border: 1px solid #7f1d1d; overflow: hidden;">
        <div style="background: #450a0a; padding: 20px 24px; border-bottom: 1px solid #dc2626;">
          <h2 style="margin: 0; color: #f87171; font-size: 18px;">
            ✖ Deployment Failed
          </h2>
        </div>
        <div style="padding: 24px;">
          <p style="margin-top: 0; color: #fca5a5;">Deployment for service <strong>${serviceName}</strong> to environment <strong>${envType}</strong> encountered an error and was halted.</p>
          <div style="background: #18181b; border: 1px solid #3f3f46; border-radius: 6px; padding: 12px; margin: 16px 0; font-family: monospace; font-size: 13px; color: #f87171;">
            ${errorReason || 'ProgressDeadlineExceeded / Container crashed'}
          </div>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #9ca3af; width: 120px;">Deployment ID:</td>
              <td style="padding: 6px 0; color: #e5e7eb; font-family: monospace;">${deploymentId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #9ca3af;">Image Tag:</td>
              <td style="padding: 6px 0; color: #e5e7eb; font-family: monospace;">${imageTag}</td>
            </tr>
          </table>
          <p style="color: #9ca3af; font-size: 13px;">If automated rollback was enabled, previous stable release was restored automatically.</p>
        </div>
      </div>
    `;

    await this.sendMail(toEmail, subject, html);

    // Chat Webhook (Slack / Discord)
    const targetWebhook = webhookUrl || process.env.CHAT_WEBHOOK_URL;
    if (targetWebhook) {
      await this.dispatchChatWebhook(targetWebhook, {
        title: `🚨 IDP Deployment Failed: ${serviceName} [${envType.toUpperCase()}]`,
        color: '#dc2626',
        fields: [
          { name: 'Service', value: serviceName },
          { name: 'Environment', value: envType },
          { name: 'Image Tag', value: imageTag },
          { name: 'Reason', value: errorReason || 'Rollout failed or timed out' },
          { name: 'Deployment ID', value: deploymentId },
        ],
      });
    }
  }

  /**
   * Quota Warning Email (80% or 100% threshold)
   */
  async sendQuotaWarning(options: QuotaWarningOptions): Promise<void> {
    const { toEmail, teamName, resourceType, percentUsed, currentUsage, limit } = options;
    const isExceeded = percentUsed >= 100;
    const alertLevel = isExceeded ? 'EXCEEDED (100%)' : 'WARNING (80%+)';
    const subject = `[IDP Quota Alert] Team ${teamName} has reached ${percentUsed.toFixed(0)}% ${resourceType} quota`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0b0e; color: #f3f4f6; border-radius: 8px; border: 1px solid #d97706; overflow: hidden;">
        <div style="background: #451a03; padding: 20px 24px; border-bottom: 1px solid #d97706;">
          <h2 style="margin: 0; color: #fbbf24; font-size: 18px;">
            ⚠ Resource Quota ${alertLevel}
          </h2>
        </div>
        <div style="padding: 24px;">
          <p style="color: #fef3c7;">Team <strong>${teamName}</strong> is approaching or has exceeded allocated resource limits for <strong>${resourceType}</strong>.</p>
          <div style="background: #1e1e24; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
              <span>Utilization: <strong>${percentUsed.toFixed(1)}%</strong></span>
              <span>${currentUsage} / ${limit}</span>
            </div>
            <div style="width: 100%; height: 8px; background: #374151; border-radius: 4px; overflow: hidden;">
              <div style="width: ${Math.min(100, percentUsed)}%; height: 100%; background: ${isExceeded ? '#ef4444' : '#f59e0b'};"></div>
            </div>
          </div>
          <p style="color: #9ca3af; font-size: 13px;">Please decommission unused environments or contact platform engineering to request an increased quota tier.</p>
        </div>
      </div>
    `;

    await this.sendMail(toEmail, subject, html);
  }

  /**
   * User Onboarding / Welcome Email
   */
  async sendWelcomeOnboarding(options: OnboardingEmailOptions): Promise<void> {
    const { toEmail, role, teamName, loginUrl } = options;
    const subject = `[IDP] Welcome to Internal Developer Platform`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0b0e; color: #f3f4f6; border-radius: 8px; border: 1px solid #3b82f6; overflow: hidden;">
        <div style="background: #1e3a8a; padding: 20px 24px; border-bottom: 1px solid #3b82f6;">
          <h2 style="margin: 0; color: #93c5fd; font-size: 18px;">
            🚀 Welcome to Internal Developer Platform
          </h2>
        </div>
        <div style="padding: 24px;">
          <p style="color: #e5e7eb;">Your account has been provisioned on the IDP self-service portal.</p>
          <ul style="color: #9ca3af; line-height: 1.8; font-size: 14px;">
            <li><strong>Assigned Team:</strong> ${teamName}</li>
            <li><strong>Role:</strong> <span style="text-transform: capitalize;">${role}</span></li>
            <li><strong>Access:</strong> Service catalog, environments, CI/CD telemetry, and AI advisory recommendations</li>
          </ul>
          ${loginUrl ? `<div style="margin: 24px 0;"><a href="${loginUrl}" style="background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">Launch Portal</a></div>` : ''}
          <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">Refer to documentation at /docs for API specifications.</p>
        </div>
      </div>
    `;

    await this.sendMail(toEmail, subject, html);
  }

  /**
   * Dispatches Slack or Discord webhook payload.
   */
  async dispatchChatWebhook(
    webhookUrl: string,
    payload: {
      title: string;
      color: string;
      fields: Array<{ name: string; value: string }>;
    }
  ): Promise<boolean> {
    try {
      const isDiscord = webhookUrl.includes('discord.com');

      let body: any;
      if (isDiscord) {
        // Discord webhook format
        body = {
          content: `**${payload.title}**`,
          embeds: [
            {
              title: payload.title,
              color: parseInt(payload.color.replace('#', ''), 16) || 14427686,
              fields: payload.fields.map(f => ({ name: f.name, value: f.value, inline: true })),
              timestamp: new Date().toISOString(),
            },
          ],
        };
      } else {
        // Slack webhook format
        body = {
          attachments: [
            {
              color: payload.color,
              title: payload.title,
              fields: payload.fields.map(f => ({
                title: f.name,
                value: f.value,
                short: true,
              })),
              ts: Math.floor(Date.now() / 1000),
            },
          ],
        };
      }

      this.sentWebhooks.push({ url: webhookUrl, payload: body });

      if (process.env.NODE_ENV !== 'test') {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          logger.warn({ status: response.status }, 'Chat webhook response not OK');
          return false;
        }
      }

      logger.info({ webhookUrl }, 'Chat webhook dispatched successfully');
      return true;
    } catch (err: any) {
      logger.error({ err: err.message, webhookUrl }, 'Failed dispatching chat webhook');
      return false;
    }
  }

  private async sendMail(to: string, subject: string, html: string): Promise<void> {
    this.sentEmails.push({ to, subject, html });

    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: env.SMTP_FROM || '"IDP Platform" <no-reply@idp.internal>',
          to,
          subject,
          html,
        });
      }
      logger.info({ to, subject }, 'Notification email sent');
    } catch (err: any) {
      logger.error({ err: err.message, to, subject }, 'Failed to deliver notification email');
    }
  }
}

export const notificationService = new NotificationService();
