import * as dotenv from "dotenv";
import { createBot } from "./bot";
import { startServer } from "./web/server";
import { createTables } from "./db";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not defined");
}

(async () => {
  // Ждем, пока БД запустится
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await createTables();
  console.log("Database tables created");
})();

const bot = createBot(token);
startServer(3000);

console.log("Bot is running...");
