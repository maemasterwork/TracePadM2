#!/bin/bash
# Single command, no arguments:  bash supabase/tests/run.sh      (database checks, then the demo-seed checks)
H="$(cd "$(dirname "$0")" && pwd)"
"$H/scratch_db.sh" bash "$H/checks.sh" || exit 1
"$H/scratch_db.sh" bash "$H/demo.sh"
