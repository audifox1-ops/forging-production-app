import { create } from 'zustand';
import { ProductionReport, ProductionEntry, EquipmentTarget, User, ProductionPeriodTarget, PeriodTargetType } from '../types';
import {
  DEMO_REPORTS,
  DEMO_ENTRIES,
  DEMO_TARGETS,
  DEMO_PERIOD_TARGETS,
  DEMO_USERS,
} from '../lib/mockData';
import { format } from 'date-fns';

interface ReportStore {
  reports: ProductionReport[];
  entries: ProductionEntry[];
  targets: EquipmentTarget[];
  periodTargets: ProductionPeriodTarget[];
  users: User[];
  currentUserId: string;

  // 보고서 관련
  getReport: (reportDate: string) => ProductionReport | undefined;
  createReport: (reportDate: string) => ProductionReport;
  updateReportStatus: (reportId: string, status: ProductionReport['status']) => void;

  // 실적 항목 관련
  getEntriesByReport: (reportId: string) => ProductionEntry[];
  getEntryByUserEquipmentShift: (reportId: string, userId: string, equipment: string, shift: string) => ProductionEntry | undefined;
  saveEntry: (entry: Partial<ProductionEntry> & { report_id: string; equipment: string; shift: string; user_id: string }) => void;
  submitEntry: (entryId: string) => void;
  returnEntry: (entryId: string) => void;
  approveEntry: (entryId: string) => void;

  // 목표값 관련
  getTargets: () => EquipmentTarget[];
  updateTarget: (equipment: string, shift: string, productTarget: number, billetTarget: number) => void;
  getPeriodTargets: () => ProductionPeriodTarget[];
  updatePeriodTarget: (period: PeriodTargetType, productTarget: number, billetTarget: number) => void;

  // 유저 관련
  setCurrentUserId: (userId: string) => void;
  getCurrentUser: () => User | undefined;
  getUsers: () => User[];
  updateUser: (userId: string, updates: Partial<User>) => void;
  addUser: (user: Omit<User, 'id' | 'created_at'>) => void;
  deleteUser: (userId: string) => void;
}

let nextId = 100;
const genId = () => `gen-${++nextId}`;

type EntryAssignment = Pick<ProductionEntry, 'equipment' | 'shift'>;

const matchesEntryAssignment = (user: User, entry: EntryAssignment) => (
  user.role === 'user' &&
  user.assigned_equipment.includes(entry.equipment) &&
  (user.assigned_shift === null || user.assigned_shift === entry.shift)
);

const findAssignedUser = (users: User[], entry: EntryAssignment) => {
  return users.find(user => matchesEntryAssignment(user, entry));
};

const syncEntryAssignees = (entries: ProductionEntry[], users: User[]) => {
  return entries.map(entry => {
    const assignedUser = findAssignedUser(users, entry);
    const userId = assignedUser?.id ?? 'unassigned';
    const userName = assignedUser?.name;

    if (entry.user_id === userId && entry.user_name === userName) {
      return entry;
    }

    return {
      ...entry,
      user_id: userId,
      user_name: userName,
    };
  });
};

export const useReportStore = create<ReportStore>((set, get) => ({
  reports: [...DEMO_REPORTS],
  entries: [...DEMO_ENTRIES],
  targets: [...DEMO_TARGETS],
  periodTargets: [...DEMO_PERIOD_TARGETS],
  users: [...DEMO_USERS],
  currentUserId: 'user-admin',

  getReport: (reportDate) => {
    return get().reports.find(r => r.report_date === reportDate);
  },

  createReport: (reportDate) => {
    const existing = get().getReport(reportDate);
    if (existing) return existing;

    const newReport: ProductionReport = {
      id: genId(),
      report_date: reportDate,
      next_plan_date: format(new Date(new Date(reportDate).getTime() + 86400000), 'yyyy-MM-dd'),
      status: 'collecting',
      created_by: 'user-admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 기본 실적 항목 생성 (설비 x 근무조 6행)
    const equipments = ['P15', 'P5', 'R/M'] as const;
    const shifts = ['주간', '야간'] as const;
    const targets = get().targets;
    const users = get().users;

    const newEntries: ProductionEntry[] = [];
    equipments.forEach(equipment => {
      shifts.forEach(shift => {
        const target = targets.find(t => t.equipment === equipment && t.shift === shift);
        // 해당 설비/근무조 담당자 찾기
        const assignedUser = findAssignedUser(users, { equipment, shift });

        newEntries.push({
          id: genId(),
          report_id: newReport.id,
          user_id: assignedUser?.id || 'unassigned',
          user_name: assignedUser?.name,
          equipment,
          shift,
          product_plan: 0,
          product_actual: 0,
          billet_plan: 0,
          billet_actual: 0,
          next_product_plan: 0,
          next_billet_plan: 0,
          submit_status: 'not_started',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });
    });

    set(state => ({
      reports: [...state.reports, newReport],
      entries: [...state.entries, ...newEntries],
    }));

    return newReport;
  },

  updateReportStatus: (reportId, status) => {
    set(state => ({
      reports: state.reports.map(r =>
        r.id === reportId
          ? { ...r, status, updated_at: new Date().toISOString(), ...(status === 'closed' ? { closed_at: new Date().toISOString() } : {}) }
          : r
      ),
    }));
  },

  getEntriesByReport: (reportId) => {
    return get().entries.filter(e => e.report_id === reportId);
  },

  getEntryByUserEquipmentShift: (reportId, userId, equipment, shift) => {
    return get().entries.find(
      e => e.report_id === reportId && e.equipment === equipment && e.shift === shift
    );
  },

  saveEntry: (entryData) => {
    const existing = get().entries.find(
      e => e.report_id === entryData.report_id &&
        e.equipment === entryData.equipment &&
        e.shift === entryData.shift
    );

    const now = new Date().toISOString();

    if (existing) {
      set(state => ({
        entries: state.entries.map(e =>
          e.id === existing.id
            ? {
                ...e,
                ...entryData,
                submit_status: e.submit_status === 'submitted' || e.submit_status === 'approved'
                  ? e.submit_status
                  : 'saved',
                updated_at: now,
              }
            : e
        ),
      }));
    } else {
      const newEntry: ProductionEntry = {
        id: genId(),
        submit_status: 'saved',
        created_at: now,
        updated_at: now,
        product_plan: 0,
        product_actual: 0,
        billet_plan: 0,
        billet_actual: 0,
        next_product_plan: 0,
        next_billet_plan: 0,
        ...entryData,
      };
      set(state => ({ entries: [...state.entries, newEntry] }));
    }
  },

  submitEntry: (entryId) => {
    set(state => ({
      entries: state.entries.map(e =>
        e.id === entryId
          ? { ...e, submit_status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          : e
      ),
    }));
  },

  returnEntry: (entryId) => {
    set(state => ({
      entries: state.entries.map(e =>
        e.id === entryId ? { ...e, submit_status: 'returned', updated_at: new Date().toISOString() } : e
      ),
    }));
  },

  approveEntry: (entryId) => {
    set(state => ({
      entries: state.entries.map(e =>
        e.id === entryId ? { ...e, submit_status: 'approved', updated_at: new Date().toISOString() } : e
      ),
    }));
  },

  getTargets: () => get().targets,

  updateTarget: (equipment, shift, productTarget, billetTarget) => {
    set(state => ({
      targets: state.targets.map(t =>
        t.equipment === equipment && t.shift === shift
          ? { ...t, product_target: productTarget, billet_target: billetTarget }
          : t
      ),
    }));
  },

  getPeriodTargets: () => get().periodTargets,

  updatePeriodTarget: (period, productTarget, billetTarget) => {
    set(state => ({
      periodTargets: state.periodTargets.map(target =>
        target.period === period
          ? { ...target, product_target: productTarget, billet_target: billetTarget }
          : target
      ),
    }));
  },

  setCurrentUserId: (userId) => {
    set({ currentUserId: userId });
  },

  getCurrentUser: () => {
    const state = get();
    return state.users.find(user => user.id === state.currentUserId);
  },

  getUsers: () => get().users,

  updateUser: (userId, updates) => {
    set(state => {
      const users = state.users.map((u): User => {
        if (u.id !== userId) return u;
        if (u.role === 'admin') {
          return {
            ...u,
            ...updates,
            role: 'admin',
            can_write: true,
            can_edit: true,
            can_delete: true,
          };
        }
        return { ...u, ...updates };
      });

      return {
        users,
        entries: syncEntryAssignees(state.entries, users),
      };
    });
  },

  addUser: (userData) => {
    const { role, can_write, can_edit, can_delete, ...rest } = userData;
    const newUser: User = {
      id: genId(),
      created_at: new Date().toISOString(),
      ...rest,
      role: role === 'admin' ? 'user' : role,
      can_write: can_write ?? false,
      can_edit: can_edit ?? false,
      can_delete: can_delete ?? false,
    };
    set(state => {
      const users = [...state.users, newUser];

      return {
        users,
        entries: syncEntryAssignees(state.entries, users),
      };
    });
  },

  deleteUser: (userId) => {
    const user = get().users.find(u => u.id === userId);
    if (!user || user.role === 'admin') return;

    set(state => {
      const users = state.users.filter(u => u.id !== userId);

      return {
        users,
        entries: syncEntryAssignees(state.entries, users),
        currentUserId: state.currentUserId === userId ? 'user-admin' : state.currentUserId,
      };
    });
  },
}));
