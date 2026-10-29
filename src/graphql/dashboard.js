import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { env } from '../config/env.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import * as admin from '../services/adminService.js';
const typeDefs = `#graphql
  type CountGroup { label: String!, count: Int! }
  type ItemStats { total: Int!, byStatus: [CountGroup!]!, byCategory: [CountGroup!]!, byType: [CountGroup!]! }
  type DailyClaims { date: String!, count: Int! }
  type ClaimUser { id: ID!, name: String!, email: String! }
  type ClaimItem { id: ID!, title: String!, category: String! }
  type RecentClaim { id: ID!, item: ClaimItem, claimant: ClaimUser, status: String!, createdAt: String! }
  type Query { itemStats: ItemStats!, claimsPerDay(days: Int = 7): [DailyClaims!]!, recentClaims(limit: Int = 10): [RecentClaim!]! }
`;
const resolvers = { Query: {
  itemStats: () => admin.itemStats(),
  claimsPerDay: (_root, { days }) => admin.claimsPerDay(Math.max(1, Math.min(90, days))),
  recentClaims: (_root, { limit }) => admin.recentClaims(Math.max(1, Math.min(50, limit)))
}, RecentClaim: { id: c => String(c._id), createdAt: c => c.createdAt.toISOString() },
   ClaimUser: { id: c => String(c._id) }, ClaimItem: { id: c => String(c._id) } };
export async function mountGraphql(app) {
  const server = new ApolloServer({ typeDefs, resolvers, introspection: env.nodeEnv !== 'production' });
  await server.start();
  app.post('/graphql', requireAuth, requireRoles('moderator', 'admin'), expressMiddleware(server));
  app.all('/graphql', (_req, res) => res.status(405).set('Allow', 'POST').json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'GraphQL accepts POST only' } }));
  return server;
}
