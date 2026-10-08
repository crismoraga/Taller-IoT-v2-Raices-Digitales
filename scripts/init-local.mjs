import { randomBytes } from "node:crypto";
import { writeFile, access } from "node:fs/promises";
try {
  await access(".env");
  console.log(".env exists; preserving local configuration.");
} catch {
  await writeFile(
    ".env",
    `APP_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001\nTEACHER_PASSWORD=${randomBytes(18).toString("base64url")}\nSECRETS_KEY=${randomBytes(32).toString("base64")}\n`,
    { flag: "wx" },
  );
  console.log(
    "Local .env created with unique teacher password and encryption key. Keep this file private.",
  );
}
