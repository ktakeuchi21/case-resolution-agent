#!/bin/bash
set -euo pipefail
umask 077
export PATH="$HOME/.bun/bin:$PATH"
export GSTACK_SETUP_RUNNING=1
export GSTACK_SETTINGS_FILE=/private/tmp/pathway-gstack-disabled-hooks.json
export GSTACK_SKIP_PLAYWRIGHT=1
export GSTACK_SKIP_COREUTILS=1
export GSTACK_SKIP_FONTS=1
export GSTACK_SKIP_ASIDE=1
export GSTACK_SKIP_GBRAIN_REGEN=1
root="$HOME/.gstack/repos/gstack"
test ! -e "$root"
mkdir -p "$HOME/.gstack/repos"
git -c core.hooksPath=/dev/null clone --no-hardlinks /private/tmp/pathway-gstack-inspection "$root"
git -C "$root" remote set-url origin https://github.com/garrytan/gstack.git
test "$(git -C "$root" rev-parse HEAD)" = 0530392821c277b95e5cd65aa9d9fda4248718b2
for kv in 'proactive false' 'routing_declined true' 'telemetry off' 'auto_upgrade false' 'update_check false' 'skill_prefix true' 'checkpoint_mode explicit' 'checkpoint_push false' 'team_mode false' 'plan_tune_hooks no' 'timeline_stop_hook no' 'redact_prepush_hook false' 'artifacts_sync_mode off' 'artifacts_sync_mode_prompted true' 'transcript_ingest_mode off' 'cross_project_learnings false' 'gstack_contributor false' 'pair_agent off' 'codex_reviews disabled'; do
  read -r key value <<< "$kv"
  "$root/bin/gstack-config" set "$key" "$value"
done
cd "$root"
/usr/bin/sandbox-exec -f /private/tmp/pathway-gstack-install.sb ./setup --host codex --prefix --no-team --no-plan-tune-hooks --no-timeline-stop-hook
