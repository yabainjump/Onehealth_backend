# Backend agent instructions

This repository is one of three independent One Health Network Git repositories. Before changing
the backend, read `.specify/memory/constitution.md` first, then the relevant files in
`docs/project/` (`PRD.md`, `ARCHITECTURE-ESSENTIALS.md`, `ARCHITECTURE.md`, `AGENTS.md`, `CODEX.md` and,
when creating structure, `SCAFFOLD.md`). The constitution overrides this file. Feature-sized
changes follow the Spec Kit cycle in `specs/` before implementation. Preserve unrelated work.

## Permanent security rules

- Security is a default engineering requirement. For a low-risk UI, copy or harmless refactor,
  follow secure coding practices and run relevant checks; do not run an expensive whole-repository
  scan by default.
- Treat authentication, authorization, roles, API routes, database access, user input, uploads,
  filesystem access, external URLs, tokens, cookies, passwords, secrets, admin functions, webhooks,
  payments, containers, infrastructure, CI/CD and cloud configuration as security-sensitive.
  Inspect the trust boundary and realistic abuse paths before changing them, then review the diff.
- Authentication is not authorization. Enforce ownership, roles, permissions and Hub country scope
  server-side, deny by default and check IDOR/BOLA, cross-user and privilege-escalation paths.
  Frontend guards and hidden buttons are only presentation.
- Treat every external input and provider response as untrusted. Use framework DTO validation and
  bounded allow-lists; assess SQL/NoSQL injection, command injection, XSS, SSRF, path traversal,
  malicious uploads, mass assignment and unsafe deserialization where the data flow makes them
  plausible. Do not invent a weaker replacement for an existing framework protection.
- Keep passwords, API keys, tokens, private keys, cloud credentials and production `.env` files out
  of Git, logs, error responses, reports and terminal output. Use environment-based secret
  management. Never copy a backend secret into either frontend.
- Minimize personal and health-sensitive data in API responses, audit logs and Rudolf context.
  Filter authorized Hub data server-side before aggregation, export or external AI calls. Source
  text is untrusted; Rudolf cannot verify an alert or publish a report.
- Avoid unnecessary dependencies; prefer maintained libraries and do not implement cryptography or
  authentication primitives manually. Do not add `@openai/codex-security` to runtime dependencies.

## Review and verification

1. For a security-sensitive change, check authentication and authorization separately, input
   validation, least privilege, exposure of sensitive data and realistic bypasses. Reject an
   obviously unsafe implementation and explain the safer approach.
2. Run focused tests and inspect the resulting Git diff. The official `codex-security` CLI is the
   preferred supplemental audit tool: prefer a targeted component review for changed security
   boundaries. Run a full repository scan only when explicitly requested, for a major release or
   major auth/infrastructure change, or when evidence suggests a wider problem. Do not rescan
   unchanged code without reason.
3. Validate a finding before reporting it: establish attacker control, reachability, the crossed
   boundary, existing protections and realistic impact. Label it **Confirmed vulnerability**,
   **Needs verification** or **Hardening recommendation**; do not call a pattern alone a flaw.
4. Fix root causes with the smallest safe change, relevant tests and diff review; prefer one
   systemic fix when several findings share a cause. Verify no new bypass was introduced.
5. Keep analysis efficient: inspect the relevant flow first, avoid repeated broad audits and
   lengthy security reports unless requested. Before completion, briefly verify authorization,
   validation, secret hygiene, data minimization and unchanged privilege boundaries.

No policy here authorizes deployment, production load tests, official health decisions or disclosure
of simulated Hub data as real. Refer to `SECURITY.md` when present for reporting and scope guidance.
