# Repository instructions

Read the relevant version-matched guide in `node_modules/next/dist/docs/` before
changing Next.js code or configuration. Use pnpm and keep journal features out of
the scaffold until they are requested.

## Dependencies and current APIs

- Before writing custom code for a common problem, such as dates, money,
  validation, forms, UI primitives, data fetching, markdown, or CSV, look for a
  maintained package that already solves it. Write custom code only when no
  suitable package exists or the problem is specific to this app. Explain the
  choice and reason in the PR.
- Before adding a package, check and report each of these in the PR:
  - **License:** Prefer MIT, Apache-2.0, or BSD. Stop and ask the owner before
    adding a package with another license.
  - **Adoption:** Check npm weekly downloads and report the number and date.
  - **Age:** Confirm the package was first published more than six months ago.
  - **Activity:** Confirm it had a release in the last 12 months and has an
    active issue tracker.
  - **Weight:** Check install size and, for client-side packages, bundle size.
  - **Install scripts:** Report any `postinstall` script and why it is needed.
- Before writing code against a library, check its current API in Context7 or
  the official documentation. Use the current documentation rather than
  relying on memory, and name the version you checked in the PR.
- Do not add a package for something trivial, such as a one-line helper. Say in
  the PR when you decide not to add one.
