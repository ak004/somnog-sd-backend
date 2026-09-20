#!/bin/sh
# Runs to completion once per deploy, before the services start.
#
# Safe to re-run on every `docker compose up`: `migrate deploy` applies only
# the migrations that are missing, and every row the seeds write is an upsert.
set -eu

SERVICES="auth-service events-service notification-service"

for service in $SERVICES; do
  echo "==> migrate  $service"
  cd "/app/apps/$service"
  npx prisma migrate deploy
done

if [ "${SEED_DEMO_DATA:-false}" != "true" ]; then
  echo "==> seed     skipped (SEED_DEMO_DATA is not \"true\")"
  exit 0
fi

# auth before events, always: the events seed attributes the conference to the
# organiser's user id, which the auth seed is what creates. Services never
# share a database, so that id can only travel as a value - the auth seed pins
# it (see apps/auth-service/prisma/seed.ts) instead of letting uuid() pick one.
for service in auth-service events-service; do
  echo "==> seed     $service"
  cd "/app/apps/$service"
  npx prisma db seed
done
