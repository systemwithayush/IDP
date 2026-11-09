import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface InMemoryStore {
  teams: any[];
  users: any[];
  resourceQuotas: any[];
  services: any[];
  environments: any[];
  auditLogs: any[];
}

export function createPrismaMock() {
  const store: InMemoryStore = {
    teams: [],
    users: [],
    resourceQuotas: [],
    services: [],
    environments: [],
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
      create: jest.fn(async ({ data }: any) => {
        const item = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
        store.resourceQuotas.push(item);
        return item;
      }),
    },

    service: {
      findUnique: jest.fn(async ({ where }: any) => {
        return store.services.find(s => s.id === where.id || s.name === where.name) || null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const item = { id: data.id || randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
        store.services.push(item);
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
