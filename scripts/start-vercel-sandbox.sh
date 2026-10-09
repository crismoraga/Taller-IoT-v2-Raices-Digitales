#!/usr/bin/env bash
set -euo pipefail

# Called after resuming the same persistent VM. Never remove data or recreate it.
cd /vercel/sandbox/workshop
exec 9>/tmp/raices-restart.lock
flock -x 9
test -s .env
test -s images.tar.gz

if ! sudo docker info >/dev/null 2>&1; then
  sudo -n bash -c 'nohup dockerd > /tmp/raices-docker.log 2>&1 </dev/null &'
  for attempt in {1..40}; do
    if sudo docker info >/dev/null 2>&1; then break; fi
    sleep 1
  done
fi
sudo docker info >/dev/null
if ! sudo docker image inspect raices-app:workshop >/dev/null 2>&1 || ! sudo docker image inspect raices-compiler:workshop >/dev/null 2>&1; then
  sudo docker load --input images.tar.gz >/dev/null
fi
sudo docker network inspect raices-private >/dev/null 2>&1 || sudo docker network create --internal raices-private >/dev/null
if [ -f .initialized ] && ! sudo docker volume inspect raices-data >/dev/null 2>&1; then
  echo 'The student data volume is missing; refusing to replace it.' >&2
  exit 1
fi
sudo docker volume inspect raices-data >/dev/null 2>&1 || sudo docker volume create raices-data >/dev/null

if ! sudo docker inspect raices-compiler >/dev/null 2>&1; then
  # The compiler receives only its own credential; it has no student volume.
  sudo docker create --name raices-compiler --restart unless-stopped --network raices-private \
    --env-file compiler.env --read-only --cap-drop ALL \
    --security-opt no-new-privileges --memory 768m --cpus 1 --pids-limit 128 \
    --tmpfs /tmp:size=256m,mode=1777 raices-compiler:workshop >/dev/null
fi
sudo docker start raices-compiler >/dev/null
if ! sudo docker inspect raices-app >/dev/null 2>&1; then
  sudo docker create --name raices-app --restart unless-stopped --network raices-private \
    --env-file .env --read-only --cap-drop ALL --security-opt no-new-privileges \
    --tmpfs /tmp:size=64m,mode=1777 --volume raices-data:/app/data \
    --publish 3001:3001 raices-app:workshop >/dev/null
fi
# Repair a partially completed first start; only the application needs egress.
if ! sudo docker inspect --format '{{json .NetworkSettings.Networks}}' raices-app | \
    node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>process.exit(JSON.parse(s).bridge?0:1))'; then
  sudo docker network connect bridge raices-app
fi
sudo docker start raices-app >/dev/null
for attempt in {1..40}; do
  if curl --fail --silent --max-time 5 http://127.0.0.1:3001/api/health | \
      node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{const h=JSON.parse(s);process.exit(h.ok&&h.arduinoAvailable?0:1)}catch{process.exit(1)}})'; then
    touch .initialized
    exit 0
  fi
  sleep 1
done
echo 'The persistent workshop backend did not become healthy.' >&2
exit 1
