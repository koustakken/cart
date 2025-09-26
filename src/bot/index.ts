import TelegramBot from "node-telegram-bot-api";
import { UserState } from "../shared/types";
import { setupCommands } from "./commands";
import { setupHandlers, handleMyBookings, handleCancel } from "./handlers";

export function createBot(token: string): TelegramBot {
  const bot = new TelegramBot(token, { polling: true });
  const userStates = new Map<number, UserState>();

  setupCommands(bot, userStates);
  setupHandlers(bot, userStates);

  // Override commands with handlers
  bot.onText(/\/mybookings/, (msg) => handleMyBookings(bot, msg));
  bot.onText(/\/cancel/, (msg) => handleCancel(bot, msg, userStates));

  return bot;
}
