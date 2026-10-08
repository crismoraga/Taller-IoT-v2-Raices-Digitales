import "dotenv/config";
import { buildApp } from "./app.ts";

const app = await buildApp();
const close = async () => {
  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};
process.once("SIGINT", close);
process.once("SIGTERM", close);
try {
  await app.listen({
    port: Number(process.env.PORT || 3001),
    host: process.env.HOST || "127.0.0.1",
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
