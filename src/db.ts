import { Pool } from "pg";

const pool = new Pool({
  host: "localhost",
  port: 5433,
  user: "user",
  password: "password",
  database: "karting_bot",
});

export async function createTables() {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        date DATE NOT NULL,
        time_slot TIME NOT NULL,
        people_count INTEGER NOT NULL CHECK (people_count > 0 AND people_count <= 5),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, time_slot)
      );
    `;
    await pool.query(query);
    console.log("Tables created successfully");
  } catch (error) {
    console.error("Error creating tables:", error);
    throw error;
  }
}

export async function checkSlotAvailability(date: string, timeSlot: string): Promise<boolean> {
  const query = "SELECT id FROM bookings WHERE date = $1 AND time_slot = $2 AND status != 'cancelled'";
  const result = await pool.query(query, [date, timeSlot]);
  return result.rows.length === 0;
}

export async function createBooking(userId: number, date: string, timeSlot: string, peopleCount: number) {
  const query = "INSERT INTO bookings (user_id, date, time_slot, people_count) VALUES ($1, $2, $3, $4) RETURNING id";
  const result = await pool.query(query, [userId, date, timeSlot, peopleCount]);
  return result.rows[0].id;
}

export async function updateBookingStatus(id: number, status: string) {
  const query = "UPDATE bookings SET status = $1 WHERE id = $2";
  await pool.query(query, [status, id]);
}

export async function getUserBookings(userId: number) {
  const query = "SELECT id, date, time_slot, people_count, status FROM bookings WHERE user_id = $1 ORDER BY date, time_slot";
  const result = await pool.query(query, [userId]);
  return result.rows;
}

export async function cancelBooking(id: number, userId: number) {
  const query = "UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND user_id = $2 AND status != 'cancelled'";
  const result = await pool.query(query, [id, userId]);
  return (result.rowCount || 0) > 0;
}
