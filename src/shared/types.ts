export interface UserState {
  step: "date" | "time" | "people" | "confirm";
  userId: number;
  date?: string;
  time?: string;
  people?: number;
}

export interface Booking {
  id: number;
  user_id: number;
  date: string;
  time_slot: string;
  people_count: number;
  status: string;
  created_at: string;
}

export interface BookingData {
  date: string;
  time: string;
  people: number;
}
