#!/usr/bin/env bash
set -euo pipefail

if [ -z "${MONGO_URI:-}" ]; then
  echo "MONGO_URI is not set." >&2
  exit 1
fi

if [ $# -lt 1 ]; then
  echo "Usage: $0 /path/to/mongo_YYYYMMDD_HHMMSS/<db_name>" >&2
  exit 1
fi

dump_dir="$1"

if [ ! -d "${dump_dir}" ]; then
  echo "Dump directory not found: ${dump_dir}" >&2
  exit 1
fi

read -r -p "This will DROP and restore data from '${dump_dir}'. Continue? [y/N] " confirm
if [ "${confirm}" != "y" ] && [ "${confirm}" != "Y" ]; then
  echo "Canceled."
  exit 0
fi

mongorestore --uri="${MONGO_URI}" --drop "${dump_dir}"
echo "Restore completed from: ${dump_dir}"
