import { k8sService } from './k8s.service.js';
import { manifestBuilder } from './manifest.builder.js';
import { setSocketServer } from '../../socket.js';
import { CoreV1Api, AppsV1Api } from '../../test/mock-k8s.js';

describe('KubernetesService', () => {
  const sampleBundle = manifestBuilder.buildBundle({
    service: { name: 'test-svc', imageRepo: 'ghcr.io/systemwithayush/test-svc' },
    environment: {
      type: 'dev',
      k8sNamespace: 'idp-test-svc-dev',
      replicas: 1,
      cpuRequestM: 100,
      memoryRequestMb: 128,
    },
    imageTag: 'v1.0.0',
    variables: [],
  });

  describe('Simulation Mode (Offline fallback)', () => {
    beforeEach(() => {
      k8sService.setClient(null, null);
    });

    it('applies manifest bundle without throwing in simulation mode', async () => {
      await expect(k8sService.applyManifestBundle(sampleBundle)).resolves.not.toThrow();
    });

    it('returns success: true for healthy deployment rollout', async () => {
      const res = await k8sService.watchRollout({
        deploymentId: 'dep-123',
        namespace: 'idp-test-svc-dev',
        deploymentName: 'test-svc',
        targetTag: 'v1.0.0',
        timeoutMs: 500,
        pollIntervalMs: 50,
      });

      expect(res.success).toBe(true);
      expect(res.replicasReady).toBe(1);
    });

    it('returns success: false when image tag is broken (simulating CrashLoop/ErrImagePull)', async () => {
      const res = await k8sService.watchRollout({
        deploymentId: 'dep-456',
        namespace: 'idp-test-svc-dev',
        deploymentName: 'test-svc',
        targetTag: 'broken-image-tag',
        timeoutMs: 500,
        pollIntervalMs: 50,
      });

      expect(res.success).toBe(false);
      expect(res.reason).toContain('ErrImagePull');
    });

    it('emits simulated pod log events to Socket.io room', async () => {
      const emittedEvents: Array<{ event: string; data: any }> = [];
      const mockIo: any = {
        to: (room: string) => ({
          emit: (event: string, data: any) => {
            emittedEvents.push({ event, data: { ...data, room } });
          },
        }),
      };

      setSocketServer(mockIo);

      await k8sService.streamPodLogs({
        deploymentId: 'dep-stream-1',
        namespace: 'idp-test-svc-dev',
        serviceName: 'test-svc',
      });

      expect(emittedEvents.length).toBeGreaterThan(0);
      expect(emittedEvents[0].event).toBe('log');
      expect(emittedEvents[0].data.room).toBe('deployment:dep-stream-1');
      expect(emittedEvents[0].data).toHaveProperty('text');
      expect(emittedEvents[0].data).toHaveProperty('timestamp');
    });
  });

  describe('Connected Cluster Mode (Using K8s Client)', () => {
    let mockCore: CoreV1Api;
    let mockApps: AppsV1Api;

    beforeEach(() => {
      mockCore = new CoreV1Api();
      mockApps = new AppsV1Api();
      k8sService.setClient(mockCore, mockApps);
    });

    afterEach(() => {
      k8sService.setClient(null, null);
    });

    it('creates or replaces namespace, configmap, secret, deployment, service', async () => {
      await expect(k8sService.applyManifestBundle(sampleBundle)).resolves.not.toThrow();

      expect(mockCore.replaceNamespacedConfigMap).toHaveBeenCalled();
      expect(mockCore.replaceNamespacedSecret).toHaveBeenCalled();
      expect(mockApps.replaceNamespacedDeployment).toHaveBeenCalled();
      expect(mockCore.replaceNamespacedService).toHaveBeenCalled();
    });

    it('watches rollout status and resolves when replicas are ready', async () => {
      const res = await k8sService.watchRollout({
        deploymentId: 'dep-789',
        namespace: 'idp-test-svc-dev',
        deploymentName: 'test-svc',
        timeoutMs: 1000,
        pollIntervalMs: 50,
      });

      expect(res.success).toBe(true);
      expect(res.replicasReady).toBe(1);
    });

    it('detects CrashLoopBackOff waiting reason in pod status', async () => {
      mockApps.readNamespacedDeploymentStatus = jest.fn(async () => ({
        spec: { replicas: 1 },
        status: { readyReplicas: 0, updatedReplicas: 1 },
      })) as any;

      mockCore.listNamespacedPod = jest.fn(async () => ({
        items: [
          {
            status: {
              containerStatuses: [
                {
                  state: {
                    waiting: {
                      reason: 'CrashLoopBackOff',
                      message: 'Back-off 10s restarting failed container',
                    },
                  },
                },
              ],
            },
          },
        ],
      })) as any;

      const res = await k8sService.watchRollout({
        deploymentId: 'dep-crash',
        namespace: 'idp-test-svc-dev',
        deploymentName: 'test-svc',
        timeoutMs: 1000,
        pollIntervalMs: 50,
      });

      expect(res.success).toBe(false);
      expect(res.reason).toContain('CrashLoopBackOff');
    });

    it('streams live logs when pods are present', async () => {
      mockCore.listNamespacedPod = jest.fn(async () => ({
        items: [
          {
            metadata: { name: 'test-svc-pod-123' },
          },
        ],
      })) as any;

      const emittedEvents: Array<{ event: string; data: any }> = [];
      const mockIo: any = {
        to: (room: string) => ({
          emit: (event: string, data: any) => {
            emittedEvents.push({ event, data: { ...data, room } });
          },
        }),
      };
      setSocketServer(mockIo);

      await k8sService.streamPodLogs({
        deploymentId: 'dep-stream-pod',
        namespace: 'idp-test-svc-dev',
        serviceName: 'test-svc',
      });

      expect(emittedEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('handles ProgressDeadlineExceeded failure condition during rollout', async () => {
      mockApps.readNamespacedDeploymentStatus = jest.fn(async () => ({
        spec: { replicas: 1 },
        status: {
          readyReplicas: 0,
          conditions: [
            {
              type: 'Progressing',
              status: 'False',
              reason: 'ProgressDeadlineExceeded',
              message: 'ReplicaSet failed to progress within deadline',
            },
          ],
        },
      })) as any;

      const res = await k8sService.watchRollout({
        deploymentId: 'dep-pde',
        namespace: 'idp-test-svc-dev',
        deploymentName: 'test-svc',
        timeoutMs: 500,
        pollIntervalMs: 50,
      });

      expect(res.success).toBe(false);
      expect(res.reason).toContain('ProgressDeadlineExceeded');
    });

    it('returns failure when rollout times out', async () => {
      mockApps.readNamespacedDeploymentStatus = jest.fn(async () => ({
        spec: { replicas: 1 },
        status: { readyReplicas: 0, updatedReplicas: 0 },
      })) as any;

      const res = await k8sService.watchRollout({
        deploymentId: 'dep-timeout',
        namespace: 'idp-test-svc-dev',
        deploymentName: 'test-svc',
        timeoutMs: 150,
        pollIntervalMs: 50,
      });

      expect(res.success).toBe(false);
      expect(res.reason).toContain('timed out');
    });

    it('handles no active pods found when streaming logs', async () => {
      mockCore.listNamespacedPod = jest.fn(async () => ({ items: [] })) as any;

      const emittedEvents: Array<{ event: string; data: any }> = [];
      const mockIo: any = {
        to: () => ({
          emit: (event: string, data: any) => emittedEvents.push({ event, data }),
        }),
      };
      setSocketServer(mockIo);

      await k8sService.streamPodLogs({
        deploymentId: 'dep-empty',
        namespace: 'idp-test-svc-dev',
        serviceName: 'test-svc',
      });

      expect(emittedEvents.some(e => e.data.text.includes('No active pods found'))).toBe(true);
    });

    it('throws wrapped error when apply fails', async () => {
      mockCore.replaceNamespacedConfigMap = jest.fn().mockRejectedValue(new Error('K8s internal API failure'));

      await expect(k8sService.applyManifestBundle(sampleBundle)).rejects.toThrow('Kubernetes apply failed');
    });
  });
});
