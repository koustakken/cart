export function getCurrentTimeInGMT5(): Date {
  return new Date(new Date().getTime() + 5 * 60 * 60 * 1000);
}

export function generateTimeSlots(dateStr: string): { text: string; callback_data: string }[][] {
  const slots: { text: string; callback_data: string }[][] = [];
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
