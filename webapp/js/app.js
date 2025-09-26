// Telegram Web App JavaScript
document.addEventListener("DOMContentLoaded", function () {
  const tg = window.Telegram.WebApp;
  tg.expand();

  const dateInput = document.getElementById("date");
  const timeSelect = document.getElementById("time");
  const bookBtn = document.getElementById("bookBtn");
  const authStatus = document.getElementById("authStatus");
  const myBookings = document.getElementById("myBookings");
  const bookingsList = document.getElementById("bookingsList");
  const refreshBtn = document.getElementById("refreshBookings");

  const API_URL = "https://your-api-server.com"; // Изменить на ваш сервер

  // Установить минимальную дату
  const today = new Date();
  const minDate = today.toISOString().split("T")[0];
  dateInput.min = minDate;

  // Максимальная дата - 7 дней вперед
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 7);
  dateInput.max = maxDate.toISOString().split("T")[0];

  // Проверка авторизации
  const user = tg.initDataUnsafe?.user;
  if (user && user.phone_number) {
    authStatus.innerHTML = `<div class="message success">Авторизован: ${user.first_name} (${user.phone_number})</div>`;
    myBookings.style.display = "block";
    loadBookings();
  } else {
    authStatus.innerHTML = '<div class="message error">Для просмотра бронирований требуется авторизация по номеру телефона.</div>';
  }

  // Генерация временных слотов
  function generateTimeSlots() {
    timeSelect.innerHTML = '<option value="">Выберите время</option>';
    for (let hour = 12; hour < 18; hour++) {
      for (let min = 0; min < 60; min += 10) {
        const time = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
        const option = document.createElement("option");
        option.value = time;
        option.textContent = time;
        timeSelect.appendChild(option);
      }
    }
  }

  generateTimeSlots();

  // Бронирование
  bookBtn.addEventListener("click", function () {
    const date = dateInput.value;
    const time = timeSelect.value;
    const people = parseInt(document.getElementById("people").value);

    if (!date || !time || !people) {
      alert("Заполните все поля");
      return;
    }

    if (people < 1 || people > 5) {
      alert("Количество человек должно быть от 1 до 5");
      return;
    }

    const bookingData = { date, time, people };
    tg.sendData(JSON.stringify(bookingData));
    tg.close();
  });

  // Загрузка бронирований
  async function loadBookings() {
    if (!user || !user.id) return;
    bookingsList.innerHTML = '<div class="loading"></div>Загрузка бронирований...';
    try {
      const response = await fetch(`${API_URL}/api/bookings?userId=${user.id}`);
      const bookings = await response.json();
      if (bookings.error) {
        bookingsList.innerHTML = '<div class="message error">Ошибка загрузки бронирований</div>';
        return;
      }
      if (bookings.length === 0) {
        bookingsList.innerHTML = "<p>Нет бронирований</p>";
        return;
      }
      bookingsList.innerHTML = bookings
        .map(
          (b) => `
                <div class="booking">
                    <div class="booking-info">
                        <strong>${b.date} ${b.time_slot}</strong><br>
                        ${b.people_count} чел. | Статус: ${b.status}
                    </div>
                    ${b.status !== "cancelled" ? `<button onclick="cancelBooking(${b.id})">Отменить</button>` : ""}
                </div>
            `
        )
        .join("");
    } catch (error) {
      bookingsList.innerHTML = '<div class="message error">Ошибка подключения к серверу</div>';
    }
  }

  // Отмена бронирования
  window.cancelBooking = async function (bookingId) {
    if (!user || !user.id) return;
    if (!confirm("Вы уверены, что хотите отменить бронирование?")) return;

    try {
      const response = await fetch(`${API_URL}/api/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, userId: user.id }),
      });
      const result = await response.json();
      if (result.success) {
        alert("Бронирование отменено");
        loadBookings();
      } else {
        alert("Ошибка отмены");
      }
    } catch (error) {
      alert("Ошибка подключения");
    }
  };

  refreshBtn.addEventListener("click", loadBookings);
});
