import {User} from './user.model'; // adapte le chemin

export interface UserListResult {
  total: number;
  page: number;
  limit: number;
  items: User[];
}
