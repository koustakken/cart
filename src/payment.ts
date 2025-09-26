// @ts-ignore
const { YooCheckout } = require("@a2seven/yoo-checkout");

const checkout = new YooCheckout({
  shopId: process.env.YOOKASSA_SHOP_ID!,
  secretKey: process.env.YOOKASSA_SECRET_KEY!,
});

export async function createPayment(amount: number, description: string, bookingId: number) {
  const payment = await checkout.createPayment({
    amount: {
      value: amount.toString(),
      currency: "RUB",
    },
    payment_method_data: {
      type: "bank_card",
    },
    confirmation: {
      type: "redirect",
      return_url: "https://t.me/your_bot", // Заменить на URL бота
    },
    description,
    metadata: {
      bookingId: bookingId.toString(),
    },
  });
  return payment;
}
