# Local agent runtime providers

Lycium treats Claude Code, Codex, and future InfRing-hosted agents as local agent runtimes rather than normal API-key LLM providers.

The provider settings UI can store a local bridge command for these runtimes. The command is expected to implement the Lycium agent-runtime bridge protocol:

- Probe request: read a JSON object with `type: "lycium-agent-runtime-probe-v1"` from stdin and write a JSON object to stdout.
- Generation request: read a JSON object with `type: "lycium-agent-runtime-generate-v1"` from stdin and write a JSON object containing generated text to stdout.
- Response shape: return either an OpenAI-style `choices[0].message.content`, a top-level `content`, `text`, `response`, or `output` string.
- Failure behavior: return non-zero or `{ "ok": false, "error": "..." }` so Lycium can fail closed and display a clear connection error.

This keeps Lycium independent from any single CLI surface. A small wrapper can route requests to Claude Code, Codex, an InfRing OS primitive, or another local agent account while preserving the same Lycium course-generation contract.

Lycium ships a default bridge at `services/lycium-api/scripts/agent_runtime_bridge.py`. When the local API lists providers, it autofills Claude Code and Codex with an absolute command such as:

```bash
python3 /path/to/Lyceum/services/lycium-api/scripts/agent_runtime_bridge.py --runtime codex
```

The bridge auto-detects `codex` or `claude` on `PATH`. Users can override detection with `LYCIUM_CODEX_COMMAND` or `LYCIUM_CLAUDE_COMMAND`.

Native Lycium bridge behavior is intentionally temporary. When Lycium runs on top of InfRing, local agent runtimes should be accessed through InfRing primitives instead of bespoke Lycium adapters.
