export type AuthHistoryUser = {
  _id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  role?: string | null;
};

export type AuthHistoryItem = {
  _id: string;
  user?: AuthHistoryUser | null;
  email?: string | null;
  role?: string | null;
  action: 'LOGIN' | 'LOGOUT';
  status?: 'SUCCESS' | 'FAIL' | string;
  reason?: string | null;
  geo?: { country?: string | null; city?: string | null } | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

export type AuthHistoryResult = {
  total: number;
  page: number;
  limit: number;
  items: AuthHistoryItem[];
};
