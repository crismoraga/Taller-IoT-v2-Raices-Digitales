#!/usr/bin/env bash
set -euo pipefail

base=/vercel/sandbox/workshop
app_root="$base/root/app"
env_file="$base/.env"
database_file="$base/data/raices.sqlite"
pid_file="$base/server.pid"
origin_file="$base/server-origin"
log_file="$base/server.log"
compiler_origin="${1:-}"

cd "$app_root"
exec 9>"$base/restart.lock"
flock -x 9
test -s "$env_file"
test -f server/index.ts
if [ -f "$base/.initialized" ] && [ ! -s "$database_file" ]; then
  echo 'The student database is missing; refusing to create a replacement.' >&2
  exit 1
fi

origin_changed=0
if node --input-type=module - "$compiler_origin" "$env_file" "$origin_file" "$pid_file" <<'NODE'
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { parseEnv } from 'node:util';
try {
  const [input, path, originPath, pidPath] = process.argv.slice(2);
  const url = new URL(input);
  const labels = url.hostname.split('.');
  const validLabel = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.pathname !== '/' || url.search || url.hash || labels.length < 3 ||
      labels.slice(-2).join('.') !== 'vercel.run' ||
      labels.some(label => label.length > 63 || !validLabel.test(label))) {
    throw new Error('invalid origin');
  }
  const text = readFileSync(path, 'utf8');
  if (parseEnv(text).ARDUINO_SERVICE_URL !== url.origin) {
    const updated = text.replace(/^\s*(?:export\s+)?ARDUINO_SERVICE_URL\s*=.*(?:\r?\n|$)/gm, '');
    const temporary = `${path}.next`;
    writeFileSync(temporary, `${updated.trimEnd()}\nARDUINO_SERVICE_URL=${url.origin}\n`, { mode: 0o600 });
    renameSync(temporary, path);
  }
  let started;
  let pid;
  try { started = JSON.parse(readFileSync(originPath, 'utf8')); pid = readFileSync(pidPath, 'utf8').trim(); } catch {}
  if (started?.origin !== url.origin || started?.pid !== pid) process.exitCode = 10;
} catch {
  console.error('The compiler URL must be a valid HTTPS vercel.run origin, and the private configuration must be readable.');
  process.exitCode = 1;
}
NODE
then
  :
else
  update_status=$?
  if [ "$update_status" -eq 10 ]; then origin_changed=1; else exit 1; fi
fi

managed_process() {
  [ -f "$pid_file" ] || return 1
  server_pid="$(cat "$pid_file")"
  [[ "$server_pid" =~ ^[1-9][0-9]*$ ]] || return 1
  node --input-type=module - "$server_pid" "$app_root" "$env_file" <<'NODE'
import { readFileSync, readlinkSync } from 'node:fs';
try {
  const [pid, directory, env] = process.argv.slice(2);
  const args = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean);
  const valid = args.length === 4 && /(?:^|\/)node$/.test(args[0]) &&
    args[1] === `--env-file=${env}` && args[2] === '--import=tsx' &&
    args[3] === 'server/index.ts' && readlinkSync(`/proc/${pid}/cwd`) === directory;
  process.exitCode = valid ? 0 : 1;
} catch { process.exitCode = 1; }
NODE
}

if [ "$origin_changed" -eq 1 ] && managed_process; then
  kill -TERM "$server_pid"
  for attempt in {1..10}; do
    if ! managed_process; then break; fi
    sleep 0.5
  done
  if managed_process; then kill -KILL "$server_pid"; fi
fi
if ! managed_process; then
  mkdir -p "$base/data"
  (
    exec 9>&-
    exec env -i PATH="$PATH" HOME="${HOME:-/tmp}" \
      NODE_ENV=production HOST=0.0.0.0 PORT=3001 DATABASE_PATH="$database_file" \
      nohup node --env-file="$env_file" --import=tsx server/index.ts
  ) >"$log_file" 2>&1 </dev/null &
  printf '%s\n' "$!" >"$pid_file"
  node --input-type=module - "$env_file" "$origin_file" "$pid_file" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
writeFileSync(process.argv[3], JSON.stringify({
  pid: readFileSync(process.argv[4], 'utf8').trim(),
  origin: parseEnv(readFileSync(process.argv[2], 'utf8')).ARDUINO_SERVICE_URL,
}) + '\n', { mode: 0o600 });
NODE
fi

ready_deadline=$((SECONDS + 12))
while [ "$SECONDS" -lt "$ready_deadline" ]; do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3001/api/health | \
      node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{const h=JSON.parse(s);process.exit(h.ok===true&&h.arduinoAvailable===true?0:1)}catch{process.exit(1)}})' && managed_process; then
    touch "$base/.initialized"
    exit 0
  fi
  if ! managed_process; then break; fi
  sleep 0.25
done
echo 'The persistent workshop backend did not become healthy. Check its private server log.' >&2
exit 1
