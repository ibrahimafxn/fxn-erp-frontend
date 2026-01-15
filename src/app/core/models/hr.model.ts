import { User } from './user.model';

export type EmployeeDoc = {
  _id: string;
  user: string | User;
  type: string;
  fileUrl: string;
  detail?: string;
  expiryDate?: string | null;
  valid?: boolean;
  createdAt?: string;
};

export type EmployeeProfile = {
  _id?: string;
  user: string | User;
  jobTitle?: string;
  contractType?: 'CDI' | 'CDD' | 'STAGE' | 'FREELANCE' | 'AUTRE';
  startDate?: string | null;
  endDate?: string | null;
  address?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  notes?: string;
};

export type ComplianceResult = {
  ok: boolean;
  missing: string[];
};

export type EmployeeSummary = {
  user: User;
  profile?: EmployeeProfile | null;
  compliance?: ComplianceResult;
};

export type EmployeeListResult = {
  total: number;
  page: number;
  limit: number;
  items: EmployeeSummary[];
};

export type HrRequirements = {
  typesByRole: Record<string, string[]>;
  typeLabels: Record<string, string>;
};

export type DocAlertsSummary = {
  expired: number;
  expiring: number;
  total: number;
  days: number;
};

export type HrHistoryItem = {
  _id: string;
  user: User | string;
  actor?: User | string | null;
  action: 'PROFILE_UPDATE' | 'DOC_ADD' | 'DOC_DELETE';
  meta?: any;
  createdAt?: string;
};

export type HrHistoryResult = {
  total: number;
  page: number;
  limit: number;
  items: HrHistoryItem[];
};

export type LeaveRequest = {
  _id: string;
  user: User | string;
  type: 'CONGE' | 'MALADIE' | 'PERMISSION' | 'AUTRE';
  startDate: string;
  endDate: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
  createdBy?: User | string;
  decidedBy?: User | string | null;
  decidedAt?: string | null;
  decisionNote?: string;
  createdAt?: string;
};
