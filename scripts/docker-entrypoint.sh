#!/bin/sh
# Applies the committed migrations, then starts the server on 0.0.0.0:3000.
set -eu
./node_modules/.bin/drizzle-kit migrate
exec node scripts/next-host.mjs start
