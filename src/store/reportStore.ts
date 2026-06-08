import { create } from 'zustand';
import { ProductionReport, ProductionEntry, EquipmentTarget, User } from '../types';
import {
  DEMO_REPORTS,
  DEMO_ENTRIES,
  DEMO_TARGETS,
  DEMO_USERS,
} from '../lib/mockData';
import { format } from 'date-fns';

interface ReportStore {
  reports: ProductionReport[];
  entries: ProductionEntry[];
  targets: EquipmentTarget[];
  users: User[];

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

  // 유저 관련
  getUsers: () => User[];
  updateUser: (userId: string, updates: Partial<User>) => void;
  addUser: (user: Omit<User, 'id' | 'created_at'>) => void;
}

let nextId = 100;
const genId = () => `gen-${++nextId}`;

export const useReportStore = create<ReportStore>((set, get) => ({
  reports: [...DEMO_REPORTS],
  entries: [...DEMO_ENTRIES],
  targets: [...DEMO_TARGETS],
  users: [...DEMO_USERS],

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
        const assignedUser = users.find(u =>
          u.role === 'user' &&
          u.assigned_equipment.includes(equipment) &&
          u.assigned_shift === shift
        );

        newEntries.push({
          id: genId(),
          report_id: newReport.id,
          user_id: assignedUser?.id || 'unassigned',
          user_name: assignedUser?.name,
          equipment,
          shift,
          product_plan: target?.product_target || 0,
          product_actual: 0,
          billet_plan: target?.billet_target || 0,
          billet_actual: 0,
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

  getUsers: () => get().users,

  updateUser: (userId, updates) => {
    set(state => ({
      users: state.users.map(u => u.id === userId ? { ...u, ...updates } : u),
    }));
  },

  addUser: (userData) => {
    const newUser: User = {
      id: genId(),
      created_at: new Date().toISOString(),
      ...userData,
    };
    set(state => ({ users: [...state.users, newUser] }));
  },
}));
