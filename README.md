# SomNOG9 EMS

An event management system for SomNOG, built as NestJS microservices over
RabbitMQ with PostgreSQL and Prisma. Modelled on what SomaliREN runs today at
[events.somaliren.org.so](https://events.somaliren.org.so/).

Three reference services are implemented here. Student teams build the rest
against the same contracts — see [docs/ADDING-A-SERVICE.md](docs/ADDING-A-SERVICE.md).

| App | Queue | Owns |
| --- | --- | --- |
| `gateway` | — | HTTP under `/api`, JWT verification, validation, Swagger |
| `auth-service` | `auth_queue` | Users, credentials, roles, tokens |
| `events-service` | `events_queue` | Categories, events, workshop tracks, registrations |
| `notification-service` | `notification_queue` | Templates, delivery, retries |

## Getting started

Requires Node 22.19+, npm 10+ and Docker. Prisma 7 needs TypeScript 5.4+.

```bash
git clone <this repo> && cd somnog-ems
cp .env.example .env

npm install
npm run infra:up            # postgres, rabbitmq, redis, mailhog
npm run prisma:generate     # one client per service
npm run prisma:migrate      # one migration history per service
npm run seed                # SomNOG9 conference, 4 tracks, one user per role
npm run dev                 # all four apps, watch mode
```

Then open:

| | |
| --- | --- |
| API base | http://localhost:3000/api |
| Swagger | http://localhost:3000/api/docs |
| Health | http://localhost:3000/api/health |
| RabbitMQ management | http://localhost:15672 (guest / guest) |
| MailHog inbox | http://localhost:8025 |

Every HTTP route sits under `/api` — the gateway sets it once with
`app.setGlobalPrefix('api')`, so controllers still declare plain paths like
`@Get('events/:slug')` and nobody repeats the prefix. `/events` on its own now
returns 404.

Seeded accounts — local development only:

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | admin@somnog.so | Admin12345 |
| ORGANIZER | organizer@somnog.so | Organizer12345 |
| SPEAKER | speaker@somnog.so | Speaker12345 |
| ATTENDEE | attendee@somnog.so | Attendee12345 |

## How the services talk

Clients only ever speak HTTP, and only to the gateway. Behind it everything is
RabbitMQ, in one of two shapes:

| | RPC (request/response) | Event (publish/subscribe) |
| --- | --- | --- |
| Nest call | `client.send()` → `@MessagePattern()` | `client.emit()` → `@EventPattern()` |
| Caller | Waits for a return value | Fires and forgets |
| Naming | `auth.user.find_by_id` | `registration.confirmed` |
| Means | "Tell me X" | "X happened" |
| Listeners | Exactly one | Zero, one, or many |
| Consumer down | Caller times out | Message waits in the queue |

All of it flows through one topic exchange, `somnog.events`. Each service owns
a durable queue that Nest binds to the exchange using the patterns that service
declares. So an RPC pattern reaches exactly the one queue that handles it,
while an event reaches every queue bound to that routing key — which is how a
new student service starts receiving `registration.confirmed` without a single
line changing in the events service.

Registering for a workshop touches all three:

```
POST /api/events/:id/registrations
  gateway    verify JWT locally, no call to auth
  gateway -> events        RPC  registration.create      (waits)
  events                   check capacity in a transaction, write the row
  gateway <- events        { id, status: CONFIRMED }
  gateway -> client        201 Created                   <- user is done here
  events  -> rabbitmq      event registration.confirmed  (does not wait)
  notify  <- rabbitmq      render template, queue the email
```

Stop the notification service and register anyway: the registration still
succeeds, and the email arrives when the service comes back. That is the demo
worth running in front of the students.

## Registration forms

Two levels, and a registration answers both:

| | Event form | Track form |
| --- | --- | --- |
| Belongs to | The event (`/api/events/:id/registration-form`) | One workshop track (`/api/sessions/:id/registration-form`) |
| Asks | What the conference needs from everyone — organisation, t-shirt size | Only what that track needs — "will you bring a laptop?" |
| Controls opening times, approval, max per user | Yes | No, those are ignored |
| Required? | Usually | Optional; most tracks have none |

Registering for a track validates the event's required fields **plus** that
track's, and stores the replies in one `answers` object. Because they share
that object, a track question may not reuse a key from the event form —
`upsertSessionForm()` returns `409 CONFLICT` if you try, rather than letting
one answer quietly overwrite the other.

`GET /api/events/:slug` returns the event form and every track's form in one
response, so a client can render the whole thing without extra round trips.

Both routes accept an event **slug or UUID**:
`/api/events/somnog9-conference/registration-form` works as well as the id.

Sending `fields` on a `PUT` **replaces the whole set** — the client posts the
complete list every time, and omitting `fields` leaves the existing questions
alone while still updating the opening times and approval settings.

## Three rules

1. **Services never call each other over HTTP.** The only HTTP hop is
   browser → gateway.
2. **No service reads another service's schema.** `userId` columns in the
   events schema are plain strings, not foreign keys. Need user data? Ask over
   RPC.
3. **RPC when the caller is waiting; event when it is not.** Sending an email
   over RPC couples your response time to a mail server.

## Layout

```
apps/
  gateway/                 HTTP under /api, guards, Swagger — no business logic
                           + Dockerfile
  auth-service/            prisma schema "auth" + Dockerfile
  events-service/          prisma schema "events" + Dockerfile
  notification-service/    prisma schema "notify" + Dockerfile
libs/
  contracts/               patterns, event names, DTOs, error codes — no logic
  common/                  filters, interceptors, rpc helpers, utils
  config/                  typed env validation + RabbitMQ transport options
docker/
  docker-compose.yml       postgres, rabbitmq, redis, mailhog
  Dockerfile.migrate       one-shot: migrations + seeds, for deploys
  migrate.sh               what that image runs
```

Each service generates its own Prisma client into `src/generated/prisma/`
(gitignored). Prisma 7 requires an explicit `output` and emits TypeScript into
your source tree rather than dropping a package into `node_modules` — which
also avoids three schemas fighting over npm's single hoisted copy.

Each service has a `prisma.config.ts` too. Prisma 7 removed the
`package.json#prisma` block and no longer reads `.env` on its own, so that file
loads the root `.env` and tells the CLI where the schema, migrations and seed
live.

One Postgres instance, three schemas, three independent migration histories.
`AUTH_DATABASE_URL` ends in `?schema=auth`, and so on.

## Things worth reading in the code

| What | Where |
| --- | --- |
| Capacity and waitlist under concurrency | `events-service/src/registrations/registrations.service.ts` → `create()` |
| Idempotent consumers | `notification-service/src/notifications/notifications.service.ts` → `enqueue()` |
| Retry with backoff | `notification-service/src/queue/delivery.processor.ts` |
| Errors crossing a service boundary | `libs/common/src/rpc/service-exception.filter.ts` and `libs/common/src/http/http-exception.filter.ts` |
| Message envelope and correlation ids | `libs/contracts/src/messaging/envelope.ts` |
| Per-event vs platform permissions | `events-service` `EventRole` vs `auth-service` `UserRole` |
| Driver adapter + non-public schema | `*/src/prisma/prisma.service.ts` |
| Event form + per-track questions | `events-service/src/events/events.service.ts` → `upsertSessionForm()` |

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Run all four apps in watch mode |
| `npm run build` | Build everything, libs first |
| `npm run infra:up` / `infra:down` | Start / stop the containers |
| `npm run prisma:generate` | Generate all three clients |
| `npm run prisma:migrate` | `migrate dev` for all three services |
| `npm run seed` | Seed auth and events |
| `npm run db:reset` | Wipe volumes, migrate and seed from scratch |
| `npm run prisma:studio -w @somnog/auth-service` | Browse one service's data |

This is an **npm workspaces** monorepo: `npm install` once at the root installs
everything and links `@somnog/contracts`, `@somnog/common` and `@somnog/config`
into each app. Use `-w <package>` to run a script in one workspace.

After the first migration, later ones are made inside the service that changed:

```bash
cd apps/events-service
npx prisma migrate dev --name add_speaker_bio
```

## How the schema gets applied in a deploy

Locally you run `npm run prisma:migrate` and `npm run seed` yourself. On a
server nobody does - so CI builds a fifth image next to the four services,
`ghcr.io/<owner>/somnog-ems-migrate`, from `docker/Dockerfile.migrate`. The
deploy (see the config repo) runs it to completion before any service starts:

1. `prisma migrate deploy` for auth, events and notify, in that order.
2. If `SEED_DEMO_DATA=true`, `prisma db seed` for auth, then events.

It is a separate image rather than something the service images do at startup
because the service images ship production dependencies only: the `prisma` CLI
is a devDependency, and the seeds need ts-node plus the generated client's
TypeScript source. It carries the same tag as the services, so the schema
applied always matches the code being deployed.

Re-running it is safe - `migrate deploy` applies only what is missing, and
every row the seeds write is an upsert.

The seeds are ordered because they reference each other across a boundary they
cannot join across: the events seed credits the conference to the organiser's
user id, which lives in the auth service's database. The auth seed pins the
demo accounts' ids (`...0001` to `...0004`) so that reference resolves;
`SEED_ORGANIZER_USER_ID` overrides it if you seed against different accounts.

## A note on Prisma 7

The client is Rust-free: no engine binary is downloaded for it, queries go
through `@prisma/adapter-pg` (node-postgres), and the generated client is
TypeScript you can read. Three consequences to know about:

- `url` is no longer allowed in the `datasource` block — it lives in
  `prisma.config.ts` for the CLI, and reaches the running service through the
  adapter.
- The adapter does not understand `?schema=`; see Troubleshooting below.
- Seeds run through `tsconfig.seed.json` so they compile as CommonJS.

The `prisma` CLI still downloads a schema engine for `migrate` and
`introspect`. That is a one-time download and unrelated to the client.

## Troubleshooting

**Every route returns 404, including ones that worked yesterday** — the gateway
sets `app.setGlobalPrefix('api')`, so it is `/api/events`, not `/events`. Old
Postman collections and bookmarks need the prefix added. Two things are *not*
prefixed and should not be: the Swagger UI, mounted directly at `/api/docs` by
`SwaggerModule.setup()` and never `/api/api/docs`, and the RabbitMQ patterns,
which are not HTTP at all.

**Swagger's "Try it out" 404s** — `setGlobalPrefix()` must be called before
`SwaggerModule.createDocument()`. Call it after, and the document lists the
unprefixed paths while the server only answers prefixed ones. In
`apps/gateway/src/main.ts` the call sits above the `DocumentBuilder` block for
exactly that reason — keep it there when you edit bootstrap.

**`ECONNREFUSED` on startup** — the containers are not up yet. `npm run infra:up`,
wait for Postgres to report healthy, then `npm run dev`.

**`Cannot find module '../generated/prisma/client'`** — run
`npm run prisma:generate`. Each service generates into
`apps/<service>/src/generated/prisma` and imports it through its own
`src/prisma/prisma-client.ts`.

**Queries hit the wrong schema / "table does not exist"** — with a driver
adapter, `?schema=auth` in the connection string is a Prisma-only parameter
that node-postgres ignores. The schema name is passed explicitly in each
`PrismaService`:

```ts
new PrismaPg({ connectionString }, { schema: 'auth' })
```

Miss that in a new service and every query silently runs against `public`.

**`Cannot find module '@somnog/contracts'`** — build the libraries first:
`npm run build`. `npm run dev` does this for you via Nx `dependsOn`.

**Requests work, then start timing out with "Service did not respond in time"**
— check `messages_unacknowledged` at http://localhost:15672. If it climbs with
every request, something is consuming messages without acking them, and once it
reaches `prefetchCount` (10) RabbitMQ stops delivering and the service goes
silent. In a new service, the usual cause is registering global filters and
interceptors AFTER `connectMicroservice()` in `main.ts`: `inheritAppConfig`
copies them at creation time, so later registrations never reach the
microservice and `RmqAckInterceptor` never runs. Register them first.

**TypeScript deprecation warnings in the editor** (`moduleResolution=node10`,
`baseUrl`) — both are gone from `tsconfig.base.json`; no option it still sets is
on TypeScript 7's removal list. `baseUrl` only matters alongside `paths`, and
this repo has none: `@somnog/contracts` and friends resolve through npm
workspace symlinks instead.

Note `ignoreDeprecations` goes **inside** `compilerOptions`, not next to it —
at the top level it is silently ignored. You should not need it here. test

**On the resolution mode:** `tsconfig.base.json` uses
`module`/`moduleResolution: node16`, which is the supported setting for a
CommonJS Node project and does not disappear in TypeScript 7. No `package.json`
here declares `"type": "module"`, so node16 resolution still emits and loads
CommonJS — nothing about how the services run changed. Note your editor may
bundle a newer TypeScript than the repo's (5.9), so it can flag deprecations
`npm run build` stays silent about.

**Editor underlines every decorator: "TS1241: the runtime will invoke the
decorator with 2 arguments, but the decorator expects 3"** — while
`npm run build` passes. The TypeScript server attaches to the nearest file
named exactly `tsconfig.json`; with none, it uses its own defaults, where
`experimentalDecorators` is off and decorators are read as the ES standard
kind. Every app and lib now has one for that purpose (builds still use
`tsconfig.app.json` / `tsconfig.lib.json`). A new service needs one too — copy
it along with the rest. If the squiggles linger after adding it, restart the
TS server: Ctrl+Shift+P → "TypeScript: Restart TS Server".

**A message is stuck in a queue** — open http://localhost:15672, find the
queue, and look at whether anything is consuming it. A service that is down is
the usual answer, and that is the system working as designed.

**Emails do not arrive** — they are not meant to leave your machine. Check
http://localhost:8025.
