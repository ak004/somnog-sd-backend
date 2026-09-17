# Adding a service

For student teams. Your service owns one schema, one queue and one folder under
`apps/`. You will touch exactly two shared places: `libs/contracts` and the
gateway's client list.

Worked example: an **attendance** service that issues certificates once someone
has been checked in.

## 1. Scaffold

```bash
mkdir -p apps/attendance-service/src apps/attendance-service/prisma
```

`apps/*` is already in the root `workspaces` list, so `npm install` at the root
picks your service up automatically.

Copy `package.json`, `tsconfig.app.json`, `tsconfig.json`, `tsconfig.seed.json`,
`nest-cli.json` and `project.json` from `apps/notification-service` and replace
the name everywhere. `tsconfig.json` is the one your editor reads — without it
every decorator is underlined with TS1241 even though the build is fine. Copy
`src/prisma/` and `src/health.controller.ts` too — they are boilerplate.

Add your schema URL to `.env` and `.env.example`:

```
ATTENDANCE_DATABASE_URL="postgresql://somnog:somnog@localhost:5432/somnog_ems?schema=attendance"
ATTENDANCE_QUEUE=attendance_queue
```

## 2. Declare your contracts

In `libs/contracts/src/messaging/patterns.ts`:

```ts
export const ATTENDANCE_PATTERNS = {
  CERTIFICATE_FIND: 'attendance.certificate.find',
  CERTIFICATE_LIST_BY_USER: 'attendance.certificate.list_by_user',
} as const;
```

Put your DTOs in `libs/contracts/src/attendance/` and export them from
`src/index.ts`. Rebuild the library with `npm run build`.

**Never** import another service's internal code. `libs/contracts` is the only
thing you share.

## 3. Consume what you need

Your service listens to events the other services already publish. Nothing in
their code changes — the topic exchange delivers to every queue bound to that
routing key.

```ts
@Controller()
export class AttendanceConsumer {
  @EventPattern(DOMAIN_EVENTS.REGISTRATION_CHECKED_IN)
  async onCheckedIn(@Payload() message: Message<RegistrationCheckedInPayload>) {
    const data = unwrap(message);
    // Idempotency: this message can be redelivered after a crash.
    await this.certificates.issueOnce(message.eventId, data);
  }
}
```

Need the person's name? It is not in the payload, and it should not be — ask
the auth service:

```ts
const user = await rpc<PublicUser>(this.authClient, AUTH_PATTERNS.FIND_BY_ID, {
  userId: data.userId,
});
```

## 4. Bootstrap

Copy `src/main.ts` from any service and change the queue name. The transport
options come from `rmqServerOptions()` — do not write your own.

## 5. Expose it through the gateway

One entry in `apps/gateway/src/clients.module.ts`:

```ts
{
  name: ATTENDANCE_CLIENT,
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    rmqClientOptions(
      ATTENDANCE_CLIENT,
      config.getOrThrow<string>('RABBITMQ_URL'),
      config.get<string>('ATTENDANCE_QUEUE', 'attendance_queue'),
    ),
}
```

One controller in `apps/gateway/src/modules/`, registered in `app.module.ts`.
Keep it to validate-and-forward:

```ts
@Get('me/certificates')
mine(@CurrentUser() user: JwtClaims, @CorrelationId() cid: string) {
  return rpc(this.client, ATTENDANCE_PATTERNS.CERTIFICATE_LIST_BY_USER,
    { userId: user.sub }, { correlationId: cid });
}
```

## Rules for every team

1. Your service owns its schema and no other. No cross-schema queries, no
   foreign keys to another service's tables.
2. Every cross-service read is a message pattern. Every side effect another
   service might care about is a published event.
3. No team edits another team's `apps/` folder. Conflicts should only ever
   happen in `libs/contracts` and the gateway module list.
4. Consumers must be idempotent. RabbitMQ redelivers after a crash, so use the
   envelope's `eventId` as a key — copy the unique constraint on
   `Notification` if you need a pattern.
5. Adding an optional field to an event payload is free. Removing or renaming
   one means publishing `<name>.v2` alongside the old pattern until every
   consumer has moved.

## Definition of done

- [ ] `npm run build` passes from a clean clone
- [ ] `prisma migrate dev` creates your schema from nothing
- [ ] A seed script gives a demo something to look at
- [ ] Your routes appear in Swagger at `/api/docs`
- [ ] Stopping your service does not break anybody else's request path
- [ ] Your README section says what you own, what you publish, what you consume
