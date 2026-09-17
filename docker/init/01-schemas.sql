-- Prisma creates its own schema on migrate, but creating them up front means a
-- student who runs psql before migrating sees the intended layout.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS events;
CREATE SCHEMA IF NOT EXISTS notify;
