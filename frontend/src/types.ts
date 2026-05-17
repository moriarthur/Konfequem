export interface Room {
  id: number;
  name: string;
  location?: string;
  capacity: number;
  features?: Feature[];
}

export interface Feature {
  id: number;
  name: string;
  icon: string;
}

export interface Booking {
  id: number;
  room?: number | { id: number };
  room_name?: string;
  start_time: string;
  end_time: string;
  created_at?: string;
  status?: string;
  user?: number;
  [key: string]: unknown;
}

export interface ActiveFilters {
  capacity: number | null;
  features: number[];
}

export interface PaginatedResponse<T> {
  results?: T[];
  count?: number;
  [key: string]: unknown;
}
