import { notificationService } from './notification.service.js';

describe('NotificationService (Nodemailer, Quota Alerts, and Chat Webhooks)', () => {
  beforeEach(() => {
    notificationService.sentEmails = [];
    notificationService.sentWebhooks = [];
  });

  describe('sendDeploymentSuccess', () => {
    it('sends deployment success email with correct metadata and HTML styling', async () => {
      await notificationService.sendDeploymentSuccess({
        toEmail: 'dev@company.com',
        serviceName: 'payment-gateway',
        envType: 'prod',
        imageTag: 'v2.4.0',
        deploymentId: 'dep-success-123',
      });

      expect(notificationService.sentEmails.length).toBe(1);
      const email = notificationService.sentEmails[0];
      expect(email.to).toBe('dev@company.com');
      expect(email.subject).toContain('Deployment Succeeded: payment-gateway (prod)');
      expect(email.html).toContain('payment-gateway');
      expect(email.html).toContain('v2.4.0');
      expect(email.html).toContain('dep-success-123');
    });
  });

  describe('sendDeploymentFailure & Chat Webhooks', () => {
    it('sends failure email and dispatches Slack-formatted webhook', async () => {
      await notificationService.sendDeploymentFailure({
        toEmail: 'lead@company.com',
        serviceName: 'auth-service',
        envType: 'staging',
        imageTag: 'v1.0.5-rc1',
        deploymentId: 'dep-fail-456',
        errorReason: 'CrashLoopBackOff: exit code 137 OOMKilled',
        webhookUrl: 'https://hooks.slack.com/services/T00/B00/X00',
      });

      // Email verification
      expect(notificationService.sentEmails.length).toBe(1);
      const email = notificationService.sentEmails[0];
      expect(email.subject).toContain('Deployment Failed: auth-service (staging)');
      expect(email.html).toContain('CrashLoopBackOff');

      // Webhook verification (Slack)
      expect(notificationService.sentWebhooks.length).toBe(1);
      const webhook = notificationService.sentWebhooks[0];
      expect(webhook.url).toBe('https://hooks.slack.com/services/T00/B00/X00');
      expect(webhook.payload).toHaveProperty('attachments');
      expect(webhook.payload.attachments[0].fields.some((f: any) => f.value === 'auth-service')).toBe(true);
    });

    it('dispatches Discord-formatted webhook when discord URL is provided', async () => {
      await notificationService.dispatchChatWebhook('https://discord.com/api/webhooks/123/abc', {
        title: 'Deployment Failed: worker-service',
        color: '#dc2626',
        fields: [{ name: 'Service', value: 'worker-service' }],
      });

      expect(notificationService.sentWebhooks.length).toBe(1);
      const webhook = notificationService.sentWebhooks[0];
      expect(webhook.payload).toHaveProperty('embeds');
      expect(webhook.payload.embeds[0].title).toContain('Deployment Failed');
    });
  });

  describe('sendQuotaWarning', () => {
    it('formats warning email at 80% threshold', async () => {
      await notificationService.sendQuotaWarning({
        toEmail: 'ops@company.com',
        teamName: 'Checkout Team',
        resourceType: 'CPU',
        percentUsed: 85,
        currentUsage: 3400,
        limit: 4000,
      });

      expect(notificationService.sentEmails.length).toBe(1);
      const email = notificationService.sentEmails[0];
      expect(email.subject).toContain('85% CPU quota');
      expect(email.html).toContain('WARNING (80%+)');
      expect(email.html).toContain('3400 / 4000');
    });

    it('formats alert email at 100%+ threshold', async () => {
      await notificationService.sendQuotaWarning({
        toEmail: 'ops@company.com',
        teamName: 'Checkout Team',
        resourceType: 'Memory',
        percentUsed: 105,
        currentUsage: 8400,
        limit: 8000,
      });

      const email = notificationService.sentEmails[0];
      expect(email.html).toContain('EXCEEDED (100%)');
    });
  });

  describe('sendWelcomeOnboarding', () => {
    it('sends welcome onboarding email with team details and portal link', async () => {
      await notificationService.sendWelcomeOnboarding({
        toEmail: 'newdev@company.com',
        role: 'developer',
        teamName: 'Platform Core',
        loginUrl: 'https://idp.internal/login',
      });

      expect(notificationService.sentEmails.length).toBe(1);
      const email = notificationService.sentEmails[0];
      expect(email.subject).toContain('Welcome to Internal Developer Platform');
      expect(email.html).toContain('Platform Core');
      expect(email.html).toContain('https://idp.internal/login');
    });

    it('sends welcome onboarding email without loginUrl gracefully', async () => {
      await notificationService.sendWelcomeOnboarding({
        toEmail: 'nodevurl@company.com',
        role: 'lead',
        teamName: 'Checkout Team',
      });

      expect(notificationService.sentEmails.length).toBe(1);
      const email = notificationService.sentEmails[0];
      expect(email.html).not.toContain('Launch Portal');
    });

    it('sends deployment failure without webhookUrl when none provided', async () => {
      delete process.env.CHAT_WEBHOOK_URL;
      await notificationService.sendDeploymentFailure({
        toEmail: 'dev@company.com',
        serviceName: 'order-service',
        envType: 'dev',
        imageTag: 'v1.0.0',
        deploymentId: 'dep-no-hook',
        errorReason: 'K8s pod crash',
      });

      expect(notificationService.sentEmails.length).toBe(1);
      expect(notificationService.sentWebhooks.length).toBe(0);
    });

    it('supports setting custom transporter', () => {
      const custom: any = { sendMail: jest.fn() };
      notificationService.setTransporter(custom);
      expect(notificationService).toBeDefined();
    });
  });
});
