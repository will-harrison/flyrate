#!/bin/bash
# SessionStart hook: install the GSD ("Get Shit Done") framework so its
# /gsd-* slash commands are available in Claude Code on the web.
#
# GSD is a third-party spec-driven development framework. Its installer
# (@opengsd/gsd-core) writes Claude Code command/skill files into the
# Claude config directory. Web sessions run in a fresh, ephemeral container
# each time, so we (re)install on every session start. The install is
# idempotent, so re-running it is safe.
set -euo pipefail

# Only run in the remote (Claude Code on the web) environment. Local CLI
# users typically install GSD themselves and we don't want to clobber that.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "[session-start] Installing GSD (@opengsd/gsd-core) for Claude Code..."

# --claude --global: non-interactive install for Claude Code into the Claude
# config directory (no TTY prompts). Pinned to a major range for stability.
if npx --yes @opengsd/gsd-core@1 --claude --global; then
  echo "[session-start] GSD installed. /gsd-* commands are available."
else
  echo "[session-start] WARNING: GSD install failed (network policy may block npm)." >&2
  echo "[session-start] Continuing session without GSD." >&2
fi
