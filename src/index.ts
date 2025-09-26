import * as dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import express from "express";
import cors from "cors";
import path from "path";
import { createTables, checkSlotAvailability, createBooking, getUserBookings, cancelBooking } from "./db";
import { createPayment } from "./payment";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not defined");
}

const bot = new TelegramBot(token, { polling: true });

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.json());

// API для получения бронирований пользователя
app.get("/api/bookings", async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }
  try {
    const bookings = await getUserBookings(parseInt(userId));
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// API для отмены бронирования
app.post("/api/cancel", async (req, res) => {
  const { bookingId, userId } = req.body;
  if (!bookingId || !userId) {
    return res.status(400).json({ error: "bookingId and userId required" });
  }
  try {
    const success = await cancelBooking(bookingId, userId);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(3000, () => {
  console.log("Web App server running on port 3000");
});

(async () => {
  // Ждем, пока БД запустится
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await createTables();
  console.log("Database tables created");
})();

interface UserState {
  step: "date" | "time" | "people" | "confirm";
  userId: number;
  date?: string;
  time?: string;
  people?: number;
}

const userStates = new Map<number, UserState>();

function getCurrentTimeInGMT5() {
  return new Date(new Date().getTime() + 5 * 60 * 60 * 1000);
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userStates.delete(chatId);
  bot.sendMessage(
    chatId,
    "Добро пожаловать в бот бронирования картинг-заездов!\nИспользуйте /book для бронирования.\n/mybookings - мои бронирования\n/cancel - отменить бронирование.",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Открыть Web App", web_app: { url: "https://koustakken.github.io/cart" } }], // Заменить на реальный URL GitHub Pages
        ],
      },
    }
  );
});

bot.onText(/\/mybookings/, async (msg) => {
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
});

bot.onText(/\/cancel/, async (msg) => {
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

function generateTimeSlots(dateStr: string) {
  const slots = [];
  const now = getCurrentTimeInGMT5();
  const selectedDate = new Date(dateStr + "T00:00:00");
  const isToday = selectedDate.toDateString() === now.toDateString();

  for (let hour = 12; hour < 18; hour++) {
    for (let min = 0; min < 60; min += 10) {
      const time = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
      if (isToday) {
        const slotTime = new Date(dateStr + "T" + time + ":00");
        if (slotTime <= now) continue; // Пропустить прошедшие слоты
      }
      slots.push([{ text: time, callback_data: `time_${time}` }]);
    }
  }
  return slots;
}

console.log("Bot is running...");
