import { create } from 'zustand';
import { ProductionReport, ProductionEntry, EquipmentTarget, User, ProductionPeriodTarget, PeriodTargetType, Equipment } from '../types';
import {
  DEMO_REPORTS,
  DEMO_ENTRIES,
  DEMO_TARGETS,
  DEMO_PERIOD_TARGETS,
  DEMO_USERS,
} from '../lib/mockData';
import { addDays, format, parseISO } from 'date-fns';
import {
  getInitialStorageMode,
  getStorageErrorMessage,
  loadLocalReportState,
  loadSupabaseReportState,
  PersistedReportState,
  saveLocalReportState,
  saveSupabaseReportState,
  StorageMode,
} from './persistence';

interface CreateReportOptions {
  sourceReportDate?: string;
}

interface ReportStore {
  reports: ProductionReport[];
  entries: ProductionEntry[];
  targets: EquipmentTarget[];
  periodTargets: ProductionPeriodTarget[];
  users: User[];
  currentUserId: string;
  storageMode: StorageMode;
  hasHydrated: boolean;
  isHydrating: boolean;
  syncError?: string;
  lastSyncedAt?: string;

  // 보고서 관련
  getReport: (reportDate: string) => ProductionReport | undefined;
  createReport: (reportDate: string, options?: CreateReportOptions) => ProductionReport;
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
  hydrateStorage: () => Promise<void>;
}

let nextId = 100;
const genId = () => globalThis.crypto?.randomUUID?.() ?? `gen-${++nextId}`;

const LOCAL_STATE = loadLocalReportState();

const getInitialArray = <T>(localValue: T[] | undefined, fallback: T[]) =>
  Array.isArray(localValue) ? localValue : [...fallback];

const INITIAL_ASSIGNEES_BY_EQUIPMENT: Record<Equipment, Pick<ProductionEntry, 'user_id' | 'user_name'>> = {
  P15: { user_id: 'user-kim-hyun', user_name: '김현 차장' },
  P5: { user_id: 'user-koo-byeongjun', user_name: '구병준 차장' },
  'R/M': { user_id: 'user-woo-jaehan', user_name: '우재한 과장' },
};

export const useReportStore = create<ReportStore>((set, get) => {
  const getPersistedState = (): PersistedReportState => {
    const state = get();
    return {
      reports: state.reports,
      entries: state.entries,
      targets: state.targets,
      periodTargets: state.periodTargets,
      users: state.users,
      currentUserId: state.currentUserId,
    };
  };

  const persistCurrentState = (syncRemote = true) => {
    const snapshot = getPersistedState();
    saveLocalReportState(snapshot);

    if (!syncRemote || get().storageMode !== 'supabase') return;

    void saveSupabaseReportState(snapshot)
      .then(() => {
        set({ lastSyncedAt: new Date().toISOString(), syncError: undefined });
      })
      .catch(error => {
        set({ syncError: getStorageErrorMessage(error) });
      });
  };

  const getSourceReport = (reportDate: string, options?: CreateReportOptions) => {
    if (options?.sourceReportDate) {
      return get().getReport(options.sourceReportDate);
    }

    return [...get().reports]
      .filter(report => report.report_date < reportDate)
      .sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())[0];
  };

  const resolveCurrentUserId = (users: User[], currentUserId: string) => {
    if (users.some(user => user.id === currentUserId)) return currentUserId;
    return users.find(user => user.role === 'admin')?.id ?? users[0]?.id ?? currentUserId;
  };

  return ({
  reports: getInitialArray(LOCAL_STATE?.reports, DEMO_REPORTS),
  entries: getInitialArray(LOCAL_STATE?.entries, DEMO_ENTRIES),
  targets: getInitialArray(LOCAL_STATE?.targets, DEMO_TARGETS),
  periodTargets: getInitialArray(LOCAL_STATE?.periodTargets, DEMO_PERIOD_TARGETS),
  users: getInitialArray(LOCAL_STATE?.users, DEMO_USERS),
  currentUserId: LOCAL_STATE?.currentUserId || 'user-admin',
  storageMode: getInitialStorageMode(),
  hasHydrated: false,
  isHydrating: false,
  syncError: undefined,
  lastSyncedAt: undefined,

  getReport: (reportDate) => {
    return get().reports.find(r => r.report_date === reportDate);
  },

  createReport: (reportDate, options) => {
    const existing = get().getReport(reportDate);
    if (existing) return existing;
    const sourceReport = getSourceReport(reportDate, options);
    const sourceEntries = sourceReport ? get().getEntriesByReport(sourceReport.id) : [];

    const newReport: ProductionReport = {
      id: genId(),
      report_date: reportDate,
      next_plan_date: format(addDays(parseISO(reportDate), 1), 'yyyy-MM-dd'),
      status: 'collecting',
      created_by: get().currentUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 기본 실적 항목 생성 (설비 x 근무조 6행)
    const equipments = ['P15', 'P5', 'R/M'] as const;
    const shifts = ['주간', '야간'] as const;
    const targets = get().targets;

    const newEntries: ProductionEntry[] = [];
    equipments.forEach(equipment => {
      shifts.forEach(shift => {
        const target = targets.find(t => t.equipment === equipment && t.shift === shift);
        const sourceEntry = sourceEntries.find(entry => entry.equipment === equipment && entry.shift === shift);
        const initialAssignee = INITIAL_ASSIGNEES_BY_EQUIPMENT[equipment];

        newEntries.push({
          id: genId(),
          report_id: newReport.id,
          user_id: initialAssignee.user_id,
          user_name: initialAssignee.user_name,
          equipment,
          shift,
          product_plan: sourceEntry?.next_product_plan ?? target?.product_target ?? 0,
          product_actual: 0,
          billet_plan: sourceEntry?.next_billet_plan ?? target?.billet_target ?? 0,
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
    persistCurrentState();

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
    persistCurrentState();
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
    persistCurrentState();
  },

  submitEntry: (entryId) => {
    set(state => ({
      entries: state.entries.map(e =>
        e.id === entryId
          ? { ...e, submit_status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          : e
      ),
    }));
    persistCurrentState();
  },

  returnEntry: (entryId) => {
    set(state => ({
      entries: state.entries.map(e =>
        e.id === entryId ? { ...e, submit_status: 'returned', updated_at: new Date().toISOString() } : e
      ),
    }));
    persistCurrentState();
  },

  approveEntry: (entryId) => {
    set(state => ({
      entries: state.entries.map(e =>
        e.id === entryId ? { ...e, submit_status: 'approved', updated_at: new Date().toISOString() } : e
      ),
    }));
    persistCurrentState();
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
    persistCurrentState();
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
    persistCurrentState();
  },

  setCurrentUserId: (userId) => {
    set({ currentUserId: userId });
    persistCurrentState(false);
  },

  getCurrentUser: () => {
    const state = get();
    return state.users.find(user => user.id === state.currentUserId);
  },

  getUsers: () => get().users,

  updateUser: (userId, updates) => {
    set(state => ({
      users: state.users.map((u): User => {
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
      }),
    }));
    persistCurrentState();
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
    set(state => ({ users: [...state.users, newUser] }));
    persistCurrentState();
  },

  deleteUser: (userId) => {
    const user = get().users.find(u => u.id === userId);
    if (!user || user.role === 'admin') return;

    set(state => ({
      users: state.users.filter(u => u.id !== userId),
      currentUserId: state.currentUserId === userId ? 'user-admin' : state.currentUserId,
    }));
    persistCurrentState();
  },

  hydrateStorage: async () => {
    if (get().isHydrating) return;

    const localState = loadLocalReportState();
    if (localState) {
      set(state => {
        const users = getInitialArray(localState.users, state.users);
        return {
          reports: getInitialArray(localState.reports, state.reports),
          entries: getInitialArray(localState.entries, state.entries),
          targets: getInitialArray(localState.targets, state.targets),
          periodTargets: getInitialArray(localState.periodTargets, state.periodTargets),
          users,
          currentUserId: resolveCurrentUserId(users, localState.currentUserId || state.currentUserId),
        };
      });
    }

    if (get().storageMode !== 'supabase') {
      set({ hasHydrated: true, isHydrating: false });
      saveLocalReportState(getPersistedState());
      return;
    }

    set({ isHydrating: true, syncError: undefined });
    try {
      const remoteState = await loadSupabaseReportState();
      const hasRemoteData = Boolean(
        remoteState.users?.length ||
        remoteState.reports?.length ||
        remoteState.entries?.length ||
        remoteState.targets?.length ||
        remoteState.periodTargets?.length
      );

      if (hasRemoteData) {
        set(state => {
          const users = getInitialArray(remoteState.users, state.users);
          return {
            reports: getInitialArray(remoteState.reports, state.reports),
            entries: getInitialArray(remoteState.entries, state.entries),
            targets: getInitialArray(remoteState.targets, state.targets),
            periodTargets: getInitialArray(remoteState.periodTargets, state.periodTargets),
            users,
            currentUserId: resolveCurrentUserId(users, state.currentUserId),
          };
        });
      } else {
        await saveSupabaseReportState(getPersistedState());
      }

      saveLocalReportState(getPersistedState());
      set({
        hasHydrated: true,
        isHydrating: false,
        lastSyncedAt: new Date().toISOString(),
        syncError: undefined,
      });
    } catch (error) {
      saveLocalReportState(getPersistedState());
      set({
        hasHydrated: true,
        isHydrating: false,
        syncError: getStorageErrorMessage(error),
      });
    }
  },
});
});
