# Database roles

`scripts/db-roles.sql` provisions two PostgreSQL 17 login roles:

- `journal_app`: CONNECT, schema USAGE, SELECT/INSERT/UPDATE on app tables,
  and sequence USAGE. No DELETE, TRUNCATE, schema CREATE or table ownership.
- `journal_migration`: owns the `public` schema, its existing tables, sequences
  and enums, and objects it creates. Database CREATE permits Drizzle's separate
  migration metadata schema. It has no cluster administration privileges.

The database must be dedicated to this app: all tables in `public` are app
tables. The script revokes PUBLIC database and public-schema privileges, so
review access for other users first. Existing custom functions, views, other
schemas and migration metadata are not transferred or audited by this script.
Use a fresh dedicated database if those objects could expose elevated access.

## Provisioning

Run once as a PostgreSQL superuser against the explicitly chosen database.
Do not run this task's validation against the development or test database.
For a throwaway check, create `journal_roles_check` on an isolated server:

```sh
createdb -U postgres journal_roles_check
psql -X -U postgres -d journal_roles_check -v expected_database=journal_roles_check -f scripts/db-roles.sql
```

The explicit name must match the connection's database. Maintenance databases
are rejected. Roles are cluster-wide: if either name exists, the transaction
fails without modifying it. Use a fresh cluster for repeatable checks.

No passwords are embedded. Both roles start with NULL passwords, disabling
password authentication until an administrator sets them interactively:

```text
\password journal_app
\password journal_migration
```

Use secure server authentication. NULL passwords do not block trust or peer
authentication. Keep migration credentials out of the app runtime. This task
does not change connection strings. When adopting these roles separately,
run migrations as `journal_migration` from the start, including creation of
Drizzle metadata. For an existing metadata schema, its ownership needs a
separate administrator review. Never grant migration membership to the app.
Future table/sequence grants apply only to objects created by
`journal_migration` in `public`, not objects created by an administrator.

Hard deletes are denied on every app table, including journals and entries.
The current schema has no soft-delete field. A future soft-delete migration
can use UPDATE; this script does not add columns or deletion behavior.

## Throwaway verification

Apply the existing `drizzle/*.sql` migrations, then run the role script to
check ownership transfer. Connect as `journal_app` and insert a journal and
entry, read them, and update the entry. DROP TABLE, DELETE and TRUNCATE must
fail. As `journal_migration`, create a temporary check table in `public` with
a serial column, then verify the app can insert/read/update rows using its
sequence without new grants, but cannot delete rows or drop the table.
Also check provisioning before migrations on a fresh database. Finally drop
the throwaway database as the administrator. On a disposable server, remove
the container to discard the cluster-wide roles too.
