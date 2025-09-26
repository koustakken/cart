import express from "express";
import cors from "cors";
import path from "path";
import { getUserBookings, cancelBooking } from "../db";
import { createPayment } from "../payment";

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "../../public")));
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

// API для создания платежа
app.post("/api/pay", async (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId) {
    return res.status(400).json({ error: "bookingId required" });
  }
  try {
    const payment = await createPayment(500, `Бронирование картинг-заезда #${bookingId}`, bookingId);
    const paymentUrl = (payment as any).confirmation.confirmation_url;
    res.json({ paymentUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Payment creation failed" });
  }
});

export function startServer(port: number = 3000) {
  app.listen(port, () => {
    console.log(`Web App server running on port ${port}`);
  });
}
