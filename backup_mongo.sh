#!/usr/bin/env bash
set -euo pipefail

if [ -z "${MONGO_URI:-}" ]; then
  echo "MONGO_URI is not set." >&2
  exit 1
fi

backup_root="${BACKUP_ROOT:-/home/coulibaly/backup}"
ts="$(date +%Y%m%d_%H%M%S)"
out_dir="${backup_root}/mongo_${ts}"

mkdir -p "${backup_root}"
mongodump --uri="${MONGO_URI}" --out "${out_dir}"
echo "Backup completed: ${out_dir}"
