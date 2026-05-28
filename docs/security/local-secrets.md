# Local secret storage

Lycium currently stores local AI provider credentials in the local data directory under `secrets/agent.json`.

Current protections:

- The local data directory is outside the repository by default.
- The local data directory and subdirectories are chmodded to `0700` when supported by the host OS.
- Local JSON files are chmodded to `0600` when supported by the host OS.
- API responses return key previews only, never raw secret values.
- Generation run records redact sensitive keys before storing request payloads or event payloads.
- `/v1/local/security` reports the active local secret backend and permission status.

Current limitation:

- The backend is still `local-file`; secrets are not encrypted at rest and are not stored in the OS keychain yet.

Planned hardening:

- Add a keychain-backed secret adapter for macOS Keychain, Windows Credential Manager, and Linux Secret Service.
- Add encrypted local-file fallback for environments without a usable keychain.
- Add secret-rotation metadata and stale-key warnings.
- Add CI checks that prevent accidental raw secret fields in public API schemas and generation traces.
