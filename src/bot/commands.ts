import TelegramBot from "node-telegram-bot-api";
import { UserState } from "../shared/types";
import { generateTimeSlots } from "../shared/utils";

export function setupCommands(bot: TelegramBot, userStates: Map<number, UserState>) {
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userStates.delete(chatId);
    bot.sendMessage(
      chatId,
      "Добро пожаловать в бот бронирования картинг-заездов!\nИспользуйте /book для бронирования.\n/mybookings - мои бронирования\n/cancel - отменить бронирование.",
      {
        reply_markup: {
          inline_keyboard: [[{ text: "Открыть Web App", web_app: { url: process.env.WEBAPP_URL || "https://koustakken.github.io/cart" } }]],
        },
      }
    );
  });

  bot.onText(/\/mybookings/, async (msg) => {
    // Implementation moved to handlers
  });

  bot.onText(/\/cancel/, async (msg) => {
    // Implementation moved to handlers
  });

  bot.onText(/\/book/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    if (!userId) return;
    userStates.set(chatId, { step: "date", userId });
    const keyboard = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      const label = i === 0 ? "Сегодня" : i === 1 ? "Завтра" : date.toLocaleDateString("ru-RU");
      keyboard.push([{ text: label, callback_data: `date_${dateStr}` }]);
    }
    bot.sendMessage(chatId, "Выберите дату заезда:", {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  });
}
