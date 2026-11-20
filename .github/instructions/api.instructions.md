---
applyTo: "apps/api/**"
---

# API

- Authorization is decided on the server. Every query is scoped to the authenticated owner; a resource owned by someone else returns 404.
- Validate every input at the boundary with a schema; do not trust the document body beyond its envelope.
- Tokens and session ids are random, stored hashed, single use or rotated, with an expiry.
- No secrets in code, logs or error messages. Config comes from validated environment variables and fails fast.
- External services (email, object storage) sit behind an interface; an implementation not tested against the real service must say so.
- New routes need tests for 401 (unauthenticated), 404 (other user's resource) and validation failure.
