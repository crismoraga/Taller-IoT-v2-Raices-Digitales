#!/usr/bin/env bash
set -euo pipefail

base=/vercel/sandbox/compiler
app_root="$base/root/app"
env_file="$base/compiler.env"
pid_file="$base/compiler.pid"
log_file="$base/compiler.log"
cli_file="$base/root/usr/local/bin/arduino-cli"

cd "$app_root"
exec 9>"$base/restart.lock"
flock -x 9
test -s "$env_file"
test -x "$cli_file"
test -f server/compiler-service.ts
node --input-type=module - "$env_file" <<'NODE'
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
try {
  const values = parseEnv(readFileSync(process.argv[2], 'utf8'));
  if (Object.keys(values).some(key => key !== 'ARDUINO_SERVICE_TOKEN') ||
      !values.ARDUINO_SERVICE_TOKEN || values.ARDUINO_SERVICE_TOKEN.length < 32) {
    throw new Error('invalid compiler configuration');
  }
} catch {
  console.error('The compiler configuration must contain only its own service credential, with at least 32 characters.');
  process.exitCode = 1;
}
NODE

managed_process() {
  [ -f "$pid_file" ] || return 1
  compiler_pid="$(cat "$pid_file")"
  [[ "$compiler_pid" =~ ^[1-9][0-9]*$ ]] || return 1
  node --input-type=module - "$compiler_pid" "$app_root" "$env_file" <<'NODE'
import { readFileSync, readlinkSync } from 'node:fs';
try {
  const [pid, directory, env] = process.argv.slice(2);
  const args = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean);
  const valid = args.length === 4 && /(?:^|\/)node$/.test(args[0]) &&
    args[1] === `--env-file=${env}` && args[2] === '--import=tsx' &&
    args[3] === 'server/compiler-service.ts' && readlinkSync(`/proc/${pid}/cwd`) === directory;
  process.exitCode = valid ? 0 : 1;
} catch { process.exitCode = 1; }
NODE
}
if ! managed_process; then
  (
    exec 9>&-
    exec env -i PATH="$PATH" HOME="${HOME:-/tmp}" \
      NODE_ENV=development ARDUINO_CLI_PATH="$cli_file" \
      ARDUINO_DIRECTORIES_DATA="$base/root/opt/arduino/data" \
      ARDUINO_DIRECTORIES_USER="$base/root/opt/arduino/user" \
      nohup node --env-file="$env_file" --import=tsx server/compiler-service.ts
  ) >"$log_file" 2>&1 </dev/null &
  printf '%s\n' "$!" >"$pid_file"
fi

ready_deadline=$((SECONDS + 12))
while [ "$SECONDS" -lt "$ready_deadline" ]; do
  if node --input-type=module - "$env_file" <<'NODE'
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
try {
  const token = parseEnv(readFileSync(process.argv[2], 'utf8')).ARDUINO_SERVICE_TOKEN;
  const response = await fetch('http://127.0.0.1:3002/health', {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(2000),
  });
  const value = await response.json();
  process.exitCode = response.ok && value.ok === true ? 0 : 1;
} catch { process.exitCode = 1; }
NODE
  then
    if managed_process; then exit 0; fi
  fi
  if ! managed_process; then break; fi
  sleep 0.25
done
echo 'The isolated compiler did not become healthy. Check its private compiler log.' >&2
exit 1
