import TelegramBot from "node-telegram-bot-api";
import { UserState } from "../shared/types";
import { generateTimeSlots } from "../shared/utils";
import { checkSlotAvailability, createBooking, getUserBookings, cancelBooking } from "../db";
import { createPayment } from "../payment";

export function setupHandlers(bot: TelegramBot, userStates: Map<number, UserState>) {
  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id;
    if (!chatId) return;

    const data = query.data;
    const state = userStates.get(chatId);
    if (!state) return;

    if (data?.startsWith("date_") && state.step === "date") {
      state.date = data.split("_")[1];
      state.step = "time";
      bot.sendMessage(chatId, `Выбрана дата: ${state.date}\nВыберите время (12:00-18:00, интервалы 10 мин):`, {
        reply_markup: {
          inline_keyboard: generateTimeSlots(state.date),
        },
      });
    } else if (data?.startsWith("time_") && state.step === "time") {
      state.time = data.split("_")[1];
      state.step = "people";
      bot.sendMessage(chatId, `Выбрано время: ${state.time}\nВведите количество человек (1-5):`);
    } else if (data === "confirm_yes" && state.step === "confirm") {
      if (!state.date || !state.time || !state.people) return;
      const available = await checkSlotAvailability(state.date, state.time);
      if (!available) {
        bot.sendMessage(chatId, "Этот слот уже занят. Выберите другой.");
        userStates.delete(chatId);
        return;
      }
      try {
        const bookingId = await createBooking(state.userId, state.date, state.time, state.people);
        const payment = await createPayment(500, `Бронирование картинг-заезда ${state.date} ${state.time}`, bookingId);
        const paymentUrl = (payment as any).confirmation.confirmation_url;
        bot.sendMessage(chatId, `Бронирование подтверждено! Оплатите 500 руб. по ссылке: ${paymentUrl}`);
      } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "Ошибка при бронировании. Попробуйте позже.");
      }
      userStates.delete(chatId);
    } else if (data === "confirm_no") {
      userStates.delete(chatId);
      bot.sendMessage(chatId, "Бронирование отменено.");
    } else if (data?.startsWith("cancel_")) {
      const bookingId = parseInt(data.split("_")[1]);
      const success = await cancelBooking(bookingId, state.userId);
      if (success) {
        bot.sendMessage(chatId, "Бронирование отменено.");
        bot.answerCallbackQuery(query.id, { text: "Бронирование отменено" });
      } else {
        bot.sendMessage(chatId, "Не удалось отменить бронирование.");
        bot.answerCallbackQuery(query.id, { text: "Ошибка отмены" });
      }
    }
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const webAppData = msg.web_app_data;
    const state = userStates.get(chatId);

    if (webAppData) {
      // Обработка данных из Web App
      try {
        const data = JSON.parse(webAppData.data);
        const userId = msg.from?.id;
        if (!userId) return;

        // Прямое бронирование из Web App
        const { date, time, people } = data;
        const available = await checkSlotAvailability(date, time);
        if (!available) {
          bot.sendMessage(chatId, "Этот слот уже занят.");
          return;
        }
        const bookingId = await createBooking(userId, date, time, people);
        const payment = await createPayment(500, `Бронирование картинг-заезда ${date} ${time}`, bookingId);
        const paymentUrl = (payment as any).confirmation.confirmation_url;
        bot.sendMessage(chatId, `Бронирование подтверждено! Оплатите 500 руб. по ссылке: ${paymentUrl}`);
      } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "Ошибка при бронировании из Web App.");
      }
      return;
    }

    if (!state || !text || text.startsWith("/")) return;

    if (state.step === "people") {
      const people = parseInt(text);
      if (isNaN(people) || people < 1 || people > 5) {
        bot.sendMessage(chatId, "Введите корректное количество человек (1-5):");
        return;
      }
      state.people = people;
      state.step = "confirm";
      bot.sendMessage(chatId, `Дата: ${state.date}\nВремя: ${state.time}\nЛюди: ${state.people}\nСтоимость: 500 руб.\nПодтвердить?`, {
        reply_markup: {
          inline_keyboard: [[{ text: "Да", callback_data: "confirm_yes" }], [{ text: "Нет", callback_data: "confirm_no" }]],
        },
      });
    }
  });
}

export async function handleMyBookings(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;

  const bookings = await getUserBookings(userId);
  if (bookings.length === 0) {
    bot.sendMessage(chatId, "У вас нет бронирований.");
    return;
  }

  let message = "Ваши бронирования:\n";
  bookings.forEach((b: any) => {
    message += `${b.id}: ${b.date} ${b.time_slot} - ${b.people_count} чел. (${b.status})\n`;
  });
  bot.sendMessage(chatId, message);
}

export async function handleCancel(bot: TelegramBot, msg: TelegramBot.Message, userStates: Map<number, UserState>) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;

  const bookings = await getUserBookings(userId);
  const activeBookings = bookings.filter((b: any) => b.status !== "cancelled");

  if (activeBookings.length === 0) {
    bot.sendMessage(chatId, "У вас нет активных бронирований для отмены.");
    return;
  }

  let message = "Выберите бронирование для отмены:\n";
  const keyboard = activeBookings.map((b: any) => [
    { text: `${b.date} ${b.time_slot} (${b.people_count} чел.)`, callback_data: `cancel_${b.id}` },
  ]);
  bot.sendMessage(chatId, message, {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
}
