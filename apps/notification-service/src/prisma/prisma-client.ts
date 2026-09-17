/**
 * The single place this service imports its Prisma client from.
 *
 * Prisma 7 requires an explicit `output` and generates TypeScript source
 * rather than dropping a package into node_modules. Generating per service
 * keeps three schemas from overwriting one another under npm's hoisting.
 */
export * from '../generated/prisma/client';
