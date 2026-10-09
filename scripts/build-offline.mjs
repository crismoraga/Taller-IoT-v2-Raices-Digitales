import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = [];
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const p = `${path}/${entry.name}`;
    if (entry.isDirectory()) await walk(p);
    else if (p !== "dist/sw.js") files.push("/" + p.replace(/^dist\//, ""));
  }
}
await walk("dist");
// También cambia la revisión cuando sólo se actualiza una guía o un recurso local.
const revision = createHash("sha256");
for (const url of files.sort()) {
  revision.update(url);
  revision.update(await readFile(`dist${url}`));
}
const version = revision.digest("hex").slice(0, 12);
await writeFile(
  "dist/sw.js",
  `const CACHE='raices-${version}';const ASSETS=${JSON.stringify(files)};self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('raices-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(u.origin!==self.location.origin||u.pathname.startsWith('/api/')||event.request.method!=='GET')return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html')));return}event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)))})`,
);
console.log(
  `Offline workshop cache ready: ${files.length} assets. API and credentials never cached.`,
);
