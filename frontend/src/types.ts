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
  /** Computed server-side: upcoming | ongoing | completed | cancelled. */
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

/** Shape of GET /api/users/me/ and the auth/register/join user objects. */
export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  /** "member" | "org_admin" (platform admins use the Django admin only). */
  role: string;
  organization?: { id: number; name: string; slug: string } | null;
  [key: string]: unknown;
}
