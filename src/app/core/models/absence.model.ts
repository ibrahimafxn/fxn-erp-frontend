import { User } from './user.model';
import { Depot } from './depot.model';

export type AbsenceType = 'CONGE' | 'MALADIE' | 'FORMATION' | 'AUTRE';
export type AbsenceStatus = 'EN_ATTENTE' | 'APPROUVE' | 'REFUSE';
export type HalfDayPeriod = 'AM' | 'PM';

export type Absence = {
  _id?: string;
  technicianId: string;
  technician?: User;
  depot?: Depot;
  startDate: string;
  endDate: string;
  isHalfDay?: boolean;
  halfDayPeriod?: HalfDayPeriod;
  type: AbsenceType;
  status: AbsenceStatus;
  comment?: string;
  createdAt?: string;
  createdBy?: User;
};
