import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface InMemoryStore {
  teams: any[];
  users: any[];
  resourceQuotas: any[];
  services: any[];
  environments: any[];
  envVariables: any[];
  goldenPathTemplates: any[];
  deployments: any[];
  deploymentEvents: any[];
  pipelineRuns: any[];
  auditLogs: any[];
}

export function createPrismaMock() {
  const store: InMemoryStore = {
    teams: [],
    users: [],
    resourceQuotas: [],
    services: [],
    environments: [],
    envVariables: [],
    goldenPathTemplates: [],
    deployments: [],
    deploymentEvents: [],
    pipelineRuns: [],
    auditLogs: [],
  };

  return {
    store,
    team: {
      findUnique: jest.fn(async ({ where }: any) => {
        const item = store.teams.find(t => t.id === where.id || t.slug === where.slug);
        if (!item) return null;
        return {
          ...item,
          resourceQuota: store.resourceQuotas.find(q => q.teamId === item.id) || null,
          services: store.services.filter(s => s.teamId === item.id).map(s => ({
            ...s,
            environments: store.environments.filter(e => e.serviceId === s.id),
          })),
        };
      }),
      findMany: jest.fn(async (_params?: any) => {
        return store.teams.map(t => ({
          ...t,
          resourceQuota: store.resourceQuotas.find(q => q.teamId === t.id) || null,
          services: store.services.filter(s => s.teamId === t.id).map(s => ({
            ...s,
            environments: store.environments.filter(e => e.serviceId === s.id),
          })),
          _count: {
            services: store.services.filter(s => s.teamId === t.id).length,
            users: store.users.filter(u => u.teamId === t.id).length,
          },
        }));
      }),
      create: jest.fn(async ({ data }: any) => {
        const item = { id: data.id || randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
        store.teams.push(item);
        return item;
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        let item = store.teams.find(t => t.id === where.id || t.slug === where.slug);
        if (item) {
          Object.assign(item, update);
        } else {
          item = { id: create.id || randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...create };
          store.teams.push(item);
        }
        return item;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const initial = store.teams.length;
        if (where?.id?.in) {
          store.teams = store.teams.filter(t => !where.id.in.includes(t.id));
        } else {
          store.teams = [];
        }
        return { count: initial - store.teams.length };
      }),
    },

    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        const u = store.users.find(u => u.id === where.id || u.email === where.email);
        if (!u) return null;
        const team = store.teams.find(t => t.id === u.teamId);
        return {
          ...u,
          team: team ? { ...team, resourceQuota: store.resourceQuotas.find(q => q.teamId === team.id) || null } : null,
        };
      }),
      findMany: jest.fn(async () => store.users),
      create: jest.fn(async ({ data }: any) => {
        const item = {
          id: data.id || randomUUID(),
          role: data.role || Role.developer,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        store.users.push(item);
        return item;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const initial = store.users.length;
        if (where?.email) {
          if (where.email.contains) {
            store.users = store.users.filter(u => !u.email.includes(where.email.contains));
          } else {
            store.users = store.users.filter(u => u.email !== where.email);
          }
        } else {
          store.users = [];
        }
        return { count: initial - store.users.length };
      }),
    },

    resourceQuota: {
      findUnique: jest.fn(async ({ where }: any) => {
        return store.resourceQuotas.find(q => q.teamId === where.teamId) || null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const item = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
        store.resourceQuotas.push(item);
        return item;
      }),
    },

    service: {
      findUnique: jest.fn(async ({ where }: any) => {
        const s = store.services.find(s => s.id === where.id || s.name === where.name);
        if (!s) return null;
        return {
          ...s,
          team: store.teams.find(t => t.id === s.teamId) || null,
          owner: store.users.find(u => u.id === s.ownerId) || null,
          template: store.goldenPathTemplates.find(tpl => tpl.id === s.templateId) || null,
          environments: store.environments.filter(e => e.serviceId === s.id),
        };
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return store.services.filter(s => {
          if (where?.teamId && s.teamId !== where.teamId) return false;
          if (where?.stack && s.stack !== where.stack) return false;
          return true;
        }).map(s => ({
          ...s,
          team: store.teams.find(t => t.id === s.teamId) || null,
          owner: store.users.find(u => u.id === s.ownerId) || null,
          template: store.goldenPathTemplates.find(tpl => tpl.id === s.templateId) || null,
          environments: store.environments.filter(e => e.serviceId === s.id),
        }));
      }),
      count: jest.fn(async ({ where }: any) => {
        return store.services.filter(s => {
          if (where?.teamId && s.teamId !== where.teamId) return false;
          return true;
        }).length;
      }),
      create: jest.fn(async ({ data }: any) => {
        const item = { id: data.id || randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
        store.services.push(item);
        return item;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const item = store.services.find(s => s.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      }),
      delete: jest.fn(async ({ where }: any) => {
        const item = store.services.find(s => s.id === where.id);
        store.services = store.services.filter(s => s.id !== where.id);
        return item;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const initial = store.services.length;
        if (where?.id) {
          store.services = store.services.filter(s => s.id !== where.id);
        } else {
          store.services = [];
        }
        return { count: initial - store.services.length };
      }),
    },

    environment: {
      findUnique: jest.fn(async ({ where }: any) => {
        const e = store.environments.find(e => e.id === where.id);
        if (!e) return null;
        return {
          ...e,
          service: store.services.find(s => s.id === e.serviceId) || null,
        };
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return store.environments.filter(e => {
          if (where?.serviceId && e.serviceId !== where.serviceId) return false;
          return true;
        }).map(e => ({
          ...e,
          _count: { envVariables: 0, deployments: 0 },
        }));
      }),
      create: jest.fn(async ({ data }: any) => {
        const item = { id: data.id || randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
        store.environments.push(item);
        return item;
      }),
    },

    envVariable: {
      findMany: jest.fn(async ({ where }: any) => {
        return store.envVariables.filter(v => v.environmentId === where.environmentId);
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        let item = store.envVariables.find(
          v => v.environmentId === where.environmentId_key.environmentId && v.key === where.environmentId_key.key
        );
        if (item) {
          Object.assign(item, { ...update, updatedAt: new Date() });
        } else {
          item = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...create };
          store.envVariables.push(item);
        }
        return item;
      }),
    },

    goldenPathTemplate: {
      findMany: jest.fn(async () => store.goldenPathTemplates),
      findUnique: jest.fn(async ({ where }: any) => {
        return store.goldenPathTemplates.find(t => t.id === where.id) || null;
      }),
    },

    deployment: {
      findUnique: jest.fn(async ({ where }: any) => {
        const d = store.deployments.find(d => d.id === where.id || d.correlationId === where.correlationId);
        if (!d) return null;
        const svc = store.services.find(s => s.id === d.serviceId) || null;
        const serviceWithTeam = svc ? { ...svc, team: store.teams.find(t => t.id === svc.teamId) || null } : null;
        return {
          ...d,
          service: serviceWithTeam,
          environment: store.environments.find(e => e.id === d.environmentId) || null,
          user: store.users.find(u => u.id === d.triggeredBy) || null,
          events: store.deploymentEvents.filter(ev => ev.deploymentId === d.id),
          pipelineRun: store.pipelineRuns.find(p => p.deploymentId === d.id) || null,
        };
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return store.deployments.find(d => {
          if (where?.serviceId && d.serviceId !== where.serviceId) return false;
          if (where?.environmentId && d.environmentId !== where.environmentId) return false;
          if (where?.status && d.status !== where.status) return false;
          if (where?.id?.not && d.id === where.id.not) return false;
          return true;
        }) || null;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return store.deployments.filter(d => {
          if (where?.serviceId && d.serviceId !== where.serviceId) return false;
          if (where?.environmentId && d.environmentId !== where.environmentId) return false;
          return true;
        }).map(d => ({
          ...d,
          service: store.services.find(s => s.id === d.serviceId) || null,
          environment: store.environments.find(e => e.id === d.environmentId) || null,
          user: store.users.find(u => u.id === d.triggeredBy) || null,
          events: store.deploymentEvents.filter(ev => ev.deploymentId === d.id),
        }));
      }),
      count: jest.fn(async () => store.deployments.length),
      create: jest.fn(async ({ data }: any) => {
        const item = {
          id: data.id || randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'requested',
          ...data,
        };
        store.deployments.push(item);
        return {
          ...item,
          service: store.services.find(s => s.id === item.serviceId) || null,
          environment: store.environments.find(e => e.id === item.environmentId) || null,
          user: store.users.find(u => u.id === item.triggeredBy) || null,
        };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const item = store.deployments.find(d => d.id === where.id);
        if (item) Object.assign(item, { ...data, updatedAt: new Date() });
        return item;
      }),
    },

    deploymentEvent: {
      create: jest.fn(async ({ data }: any) => {
        const item = { id: randomUUID(), createdAt: new Date(), ...data };
        store.deploymentEvents.push(item);
        return item;
      }),
    },

    pipelineRun: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        let item = store.pipelineRuns.find(p => p.deploymentId === where.deploymentId);
        if (item) {
          Object.assign(item, { ...update, updatedAt: new Date() });
        } else {
          item = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...create };
          store.pipelineRuns.push(item);
        }
        return item;
      }),
    },

    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        const item = { id: randomUUID(), createdAt: new Date(), ...data };
        store.auditLogs.push(item);
        return item;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return store.auditLogs.find(a => {
          if (where.action && a.action !== where.action) return false;
          if (where.entityId && a.entityId !== where.entityId) return false;
          return true;
        }) || null;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return store.auditLogs.filter(a => {
          if (where?.entityType && a.entityType !== where.entityType) return false;
          if (where?.entityId && a.entityId !== where.entityId) return false;
          if (where?.user?.teamId) {
            const user = store.users.find(u => u.id === a.userId);
            if (user?.teamId !== where.user.teamId) return false;
          }
          return true;
        }).map(a => ({
          ...a,
          user: store.users.find(u => u.id === a.userId) || null,
        }));
      }),
      count: jest.fn(async () => store.auditLogs.length),
      deleteMany: jest.fn(async (_params?: any) => {
        const c = store.auditLogs.length;
        store.auditLogs = [];
        return { count: c };
      }),
    },

    $disconnect: jest.fn(async () => {}),
  };
}
