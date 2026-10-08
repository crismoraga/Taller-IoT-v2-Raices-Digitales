import { cp, mkdir } from "node:fs/promises";
await mkdir("public/docs", { recursive: true });
await cp("docs", "public/docs", {
  recursive: true,
  filter: (path) => !path.endsWith("IMPLEMENTATION_CONTRACT.md"),
});
