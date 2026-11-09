import { manifestBuilder, ManifestBuilderOptions } from './manifest.builder.js';

describe('Kubernetes Manifest Builder', () => {
  const secretPlain = 'super-secret-db-password';

  const sampleOptions: ManifestBuilderOptions = {
    service: {
      name: 'order-api',
      imageRepo: 'ghcr.io/systemwithayush/order-api',
      port: 3000,
    },
    environment: {
      type: 'staging',
      k8sNamespace: 'idp-order-api-staging',
      replicas: 2,
      cpuRequestM: 250,
      memoryRequestMb: 512,
      cpuLimitM: 500,
      memoryLimitMb: 1024,
    },
    imageTag: 'sha-a1b2c3d',
    variables: [
      { key: 'PORT', value: '3000', isSecret: false },
      { key: 'DB_HOST', value: 'mysql.internal', isSecret: false },
      { key: 'DB_PASSWORD', value: secretPlain, isSecret: true },
    ],
    teamSlug: 'checkout-team',
  };

  it('builds a complete bundle with all 5 Kubernetes objects', () => {
    const bundle = manifestBuilder.buildBundle(sampleOptions);

    expect(bundle).toHaveProperty('namespace');
    expect(bundle).toHaveProperty('configMap');
    expect(bundle).toHaveProperty('secret');
    expect(bundle).toHaveProperty('deployment');
    expect(bundle).toHaveProperty('service');
  });

  describe('Namespace', () => {
    it('sets correct name and standard metadata labels', () => {
      const ns = manifestBuilder.buildNamespace(sampleOptions);

      expect(ns.apiVersion).toBe('v1');
      expect(ns.kind).toBe('Namespace');
      expect(ns.metadata?.name).toBe('idp-order-api-staging');
      expect(ns.metadata?.labels).toMatchObject({
        'app.kubernetes.io/managed-by': 'idp-platform',
        'idp.internal/service': 'order-api',
        'idp.internal/environment': 'staging',
        'idp.internal/team': 'checkout-team',
      });
    });
  });

  describe('ConfigMap', () => {
    it('contains non-secret variables and platform metadata', () => {
      const cm = manifestBuilder.buildConfigMap(sampleOptions);

      expect(cm.apiVersion).toBe('v1');
      expect(cm.kind).toBe('ConfigMap');
      expect(cm.metadata?.name).toBe('order-api-config');
      expect(cm.metadata?.namespace).toBe('idp-order-api-staging');
      expect(cm.data).toMatchObject({
        PORT: '3000',
        DB_HOST: 'mysql.internal',
        IDP_SERVICE_NAME: 'order-api',
        IDP_ENVIRONMENT: 'staging',
        NODE_ENV: 'staging',
      });
      // Secrets must NOT be present in ConfigMap
      expect(cm.data).not.toHaveProperty('DB_PASSWORD');
    });

    it('sets NODE_ENV to production when environment type is prod', () => {
      const cm = manifestBuilder.buildConfigMap({
        ...sampleOptions,
        environment: { ...sampleOptions.environment, type: 'prod' },
      });
      expect(cm.data?.NODE_ENV).toBe('production');
    });
  });

  describe('Secret', () => {
    it('decrypts encrypted secrets into stringData and excludes plain variables', () => {
      const sec = manifestBuilder.buildSecret(sampleOptions);

      expect(sec.apiVersion).toBe('v1');
      expect(sec.kind).toBe('Secret');
      expect(sec.type).toBe('Opaque');
      expect(sec.metadata?.name).toBe('order-api-secrets');
      expect(sec.metadata?.namespace).toBe('idp-order-api-staging');

      expect(sec.stringData).toHaveProperty('DB_PASSWORD', secretPlain);
      expect(sec.stringData).not.toHaveProperty('PORT');
      expect(sec.stringData).not.toHaveProperty('DB_HOST');
    });
  });

  describe('Deployment', () => {
    it('generates typed container spec with resource requests, limits, and probes', () => {
      const dep = manifestBuilder.buildDeployment(sampleOptions);

      expect(dep.apiVersion).toBe('apps/v1');
      expect(dep.kind).toBe('Deployment');
      expect(dep.metadata?.name).toBe('order-api');
      expect(dep.metadata?.namespace).toBe('idp-order-api-staging');
      expect(dep.spec?.replicas).toBe(2);

      const container = dep.spec?.template.spec?.containers[0];
      expect(container?.name).toBe('order-api');
      expect(container?.image).toBe('ghcr.io/systemwithayush/order-api:sha-a1b2c3d');

      // Resources
      expect(container?.resources?.requests).toEqual({
        cpu: '250m',
        memory: '512Mi',
      });
      expect(container?.resources?.limits).toEqual({
        cpu: '500m',
        memory: '1024Mi',
      });

      // envFrom references
      expect(container?.envFrom).toEqual([
        { configMapRef: { name: 'order-api-config' } },
        { secretRef: { name: 'order-api-secrets' } },
      ]);

      // Probes
      expect(container?.readinessProbe?.httpGet?.path).toBe('/health');
      expect(container?.livenessProbe?.httpGet?.path).toBe('/health');
    });
  });

  describe('Service', () => {
    it('generates ClusterIP service matching pods on port 80 -> 3000', () => {
      const svc = manifestBuilder.buildService(sampleOptions);

      expect(svc.apiVersion).toBe('v1');
      expect(svc.kind).toBe('Service');
      expect(svc.metadata?.name).toBe('order-api');
      expect(svc.metadata?.namespace).toBe('idp-order-api-staging');
      expect(svc.spec?.type).toBe('ClusterIP');
      expect(svc.spec?.selector).toEqual({
        app: 'order-api',
        env: 'staging',
      });
      expect(svc.spec?.ports).toEqual([
        {
          name: 'http',
          port: 80,
          targetPort: 3000,
          protocol: 'TCP',
        },
      ]);
    });
  });
});
