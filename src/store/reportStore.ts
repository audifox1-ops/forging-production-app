import { create } from 'zustand';
import { ProductionReport, ProductionEntry, EquipmentTarget, User, ProductionPeriodTarget, PeriodTargetType, Equipment, Shift, EQUIPMENT_LIST, SHIFT_LIST, TemplateWorkbookSheet } from '../types';
import {
  DEMO_REPORTS,
  DEMO_ENTRIES,
  DEMO_TARGETS,
  DEMO_PERIOD_TARGETS,
  DEMO_USERS,
} from '../lib/mockData';
import { format } from 'date-fns';
import {
  deleteSupabaseRows,
  getInitialStorageMode,
  getStorageErrorMessage,
  isTemplateWorkbookAnchorReport,
  loadLocalReportState,
  loadSupabaseReportState,
  PersistedReportState,
  saveLocalReportState,
  saveSupabaseReportState,
  StorageMode,
  upsertSupabaseRows,
} from './persistence';
import { getPlanDateFromActualDate } from '../utils/reportDates';
import {
  ANNUAL_TARGET_TOTALS_2026,
  SHIFT_TARGETS_2026_BY_EQUIPMENT,
  TARGET_EQUIPMENT_LIST,
  TargetEquipment,
} from '../utils/targetConfig';
import {
  addTemplateWorkbookRow,
  createAnnualTemplateSheet,
  createMonthlyTemplateSheet,
  deleteTemplateWorkbookRow,
  syncAnnualTemplateWorkbookInPlace,
  syncTemplateSheetsWithAllReportEntries,
  syncTemplateSheetsWithReportEntries,
  updateTemplateWorkbookCell,
} from '../utils/templateWorkbook';

interface CreateReportOptions {
  sourceReportDate?: string;
}

interface ReportStore {
  reports: ProductionReport[];
  entries: ProductionEntry[];
  targets: EquipmentTarget[];
  periodTargets: ProductionPeriodTarget[];
  templateSheets: TemplateWorkbookSheet[];
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
  getTemplateSheets: () => TemplateWorkbookSheet[];
  updateTemplateWorkbookCell: (sheetId: string, rowNumber: number, column: string, value: string | number | null) => void;
  deleteTemplateWorkbookRow: (sheetId: string, rowNumber: number) => void;
  addTemplateWorkbookRow: (sheetId: string) => void;
  addMonthlyTemplateSheet: (year: number, month: number) => void;

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
let remoteWriteQueue: Promise<void> = Promise.resolve();

const LOCAL_STATE = loadLocalReportState();

const getInitialArray = <T>(localValue: T[] | undefined, fallback: T[]) =>
  Array.isArray(localValue) ? localValue : [...fallback];

// \uc911\ubcf5 \uc5f0\uac04 \uc2dc\ud2b8 \uc81c\uac70: \uac19\uc740 sheet_name\uc73c\ub85c \uc5ec\ub7ec \uac1c\uc77c \ub54c, \ub370\uc774\ud130\uac00 \uac00\uc7a5 \ub9ce\uc740 \uac83\uc744 \uc720\uc9c0
const deduplicateTemplateSheets = (sheets: TemplateWorkbookSheet[]): TemplateWorkbookSheet[] => {
  const seenNames = new Map<string, TemplateWorkbookSheet>();

  for (const sheet of sheets) {
    const key = `${sheet.kind}::${sheet.sheet_name}`;
    const existing = seenNames.get(key);

    if (!existing) {
      seenNames.set(key, sheet);
    } else {
      // \ub370\uc774\ud130\uac00 \ub354 \ub9ce\uc740 \uc2dc\ud2b8\ub97c \uc720\uc9c0
      const existingCells = existing.rows.reduce((sum, row) => sum + row.cells.length, 0);
      const currentCells = sheet.rows.reduce((sum, row) => sum + row.cells.length, 0);
      if (currentCells > existingCells) {
        seenNames.set(key, sheet);
      }
    }
  }

  return Array.from(seenNames.values());
};

const normalizeReports = (reports: ProductionReport[]) =>
  reports
    .filter(report => !isTemplateWorkbookAnchorReport(report))
    .map(report =>
      (report as { status: string }).status === 'closed'
        ? { ...report, status: 'reviewed' as const }
        : report
    );

const PREVIOUS_2026_TARGETS_BY_EQUIPMENT: Record<TargetEquipment, { product: number; billet: number }> = {
  P15: { product: 17545, billet: 18150 },
  P5: { product: 8470, billet: 6070 },
  'R/M': { product: 23985, billet: 0 },
};

const isTargetEquipment = (equipment: Equipment): equipment is TargetEquipment =>
  TARGET_EQUIPMENT_LIST.includes(equipment as TargetEquipment);

const PREVIOUS_2026_ANNUAL_TARGETS = {
  product: 24200000,
  billet: 11722480,
};

const normalizeTargetDefaults = (targets: EquipmentTarget[]) => {
  let changed = false;
  const value = targets.map(target => {
    if (!isTargetEquipment(target.equipment)) return target;

    const previousTarget = PREVIOUS_2026_TARGETS_BY_EQUIPMENT[target.equipment];
    const newDefault = SHIFT_TARGETS_2026_BY_EQUIPMENT[target.equipment];
    const isPrevious2026Target = target.effective_date === '2026-01-01' &&
      target.product_target === previousTarget.product &&
      target.billet_target === previousTarget.billet;

    if (!isPrevious2026Target) return target;

    changed = true;
    return {
      ...target,
      product_target: newDefault.product,
      billet_target: newDefault.billet,
    };
  });

  return { value, changed };
};

const normalizePeriodTargetDefaults = (periodTargets: ProductionPeriodTarget[]) => {
  let changed = false;
  const value = periodTargets.map(target => {
    const isPreviousYearlyDefault = target.period === 'yearly' &&
      target.effective_date === '2026-01-01' &&
      (
        (target.product_target === 0 && target.billet_target === 0) ||
        (
          target.product_target === PREVIOUS_2026_ANNUAL_TARGETS.product &&
          target.billet_target === PREVIOUS_2026_ANNUAL_TARGETS.billet
        )
      );

    if (!isPreviousYearlyDefault) return target;

    changed = true;
    return {
      ...target,
      product_target: ANNUAL_TARGET_TOTALS_2026.product,
      billet_target: ANNUAL_TARGET_TOTALS_2026.billet,
    };
  });

  return { value, changed };
};

const addEquipment = (equipmentList: Equipment[], equipment: Equipment) =>
  equipmentList.includes(equipment) ? equipmentList : [...equipmentList, equipment];

const normalizeUserDefaults = (users: User[]) => {
  let changed = false;
  const value = users.map(user => {
    const shouldAddP8 =
      user.email === 'admin@forging.com' ||
      user.email === 'hoegeun.kim@forging.com' ||
      user.email === 'eunseo.lee@forging.com' ||
      user.email === 'jaehan.woo@forging.com';

    if (!shouldAddP8 || user.assigned_equipment.includes('P8')) return user;

    changed = true;
    const assigned_equipment = user.email === 'jaehan.woo@forging.com'
      ? addEquipment(addEquipment(user.assigned_equipment, 'R/M'), 'P8')
      : addEquipment(user.assigned_equipment, 'P8');

    return { ...user, assigned_equipment };
  });

  return { value, changed };
};

const INITIAL_ASSIGNEES_BY_EQUIPMENT: Record<Equipment, { email: string; fallbackUserId: string; userName: string }> = {
  P15: { email: 'hyun.kim@forging.com', fallbackUserId: 'user-kim-hyun', userName: '김현 차장' },
  P5: { email: 'byeongjun.koo@forging.com', fallbackUserId: 'user-koo-byeongjun', userName: '구병준 차장' },
  'R/M': { email: 'jaehan.woo@forging.com', fallbackUserId: 'user-woo-jaehan', userName: '우재한 과장' },
  P8: { email: 'jaehan.woo@forging.com', fallbackUserId: 'user-woo-jaehan', userName: '우재한 과장' },
};

export const useReportStore = create<ReportStore>((set, get) => {
  const getPersistedState = (): PersistedReportState => {
    const state = get();
    return {
      reports: state.reports,
      entries: state.entries,
      targets: state.targets,
      periodTargets: state.periodTargets,
      templateSheets: state.templateSheets,
      users: state.users,
      currentUserId: state.currentUserId,
    };
  };

  const persistCurrentState = (syncRemote = true, remoteOperation?: () => Promise<void>) => {
    const snapshot = getPersistedState();
    saveLocalReportState(snapshot);

    if (!syncRemote || !remoteOperation || get().storageMode !== 'supabase') return;

    const queuedOperation = remoteWriteQueue
      .catch(() => undefined)
      .then(remoteOperation);

    remoteWriteQueue = queuedOperation;

    void queuedOperation
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

  const buildDefaultEntry = (
    reportId: string,
    equipment: Equipment,
    shift: Shift,
    sourceEntries: ProductionEntry[]
  ): ProductionEntry => {
    const currentTarget = get().targets.find(item => item.equipment === equipment && item.shift === shift);
    const sourceEntry = sourceEntries.find(entry => entry.equipment === equipment && entry.shift === shift);
    const initialAssignee = INITIAL_ASSIGNEES_BY_EQUIPMENT[equipment];
    const assignedUser = get().users.find(user => user.email === initialAssignee.email);
    return {
      id: genId(),
      report_id: reportId,
      user_id: assignedUser?.id ?? initialAssignee.fallbackUserId,
      user_name: assignedUser?.name ?? initialAssignee.userName,
      equipment,
      shift,
      product_plan: sourceEntry?.next_product_plan ?? currentTarget?.product_target ?? 0,
      product_actual: 0,
      billet_plan: sourceEntry?.next_billet_plan ?? currentTarget?.billet_target ?? 0,
      billet_actual: 0,
      next_product_plan: 0,
      next_billet_plan: 0,
      submit_status: 'not_started',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  const buildMissingEntries = (reportId: string, sourceEntries: ProductionEntry[]) => {
    const existingEntries = get().entries.filter(entry => entry.report_id === reportId);
    const newEntries: ProductionEntry[] = [];

    EQUIPMENT_LIST.forEach(equipment => {
      SHIFT_LIST.forEach(shift => {
        const exists = existingEntries.some(entry => entry.equipment === equipment && entry.shift === shift);
        if (!exists) {
          newEntries.push(buildDefaultEntry(reportId, equipment, shift, sourceEntries));
        }
      });
    });

    return newEntries;
  };

  const initialTargets = normalizeTargetDefaults(getInitialArray(LOCAL_STATE?.targets, DEMO_TARGETS)).value;
  const initialPeriodTargets = normalizePeriodTargetDefaults(
    getInitialArray(LOCAL_STATE?.periodTargets, DEMO_PERIOD_TARGETS)
  ).value;
  const initialUsers = normalizeUserDefaults(getInitialArray(LOCAL_STATE?.users, DEMO_USERS)).value;
  const initialReports = normalizeReports(getInitialArray(LOCAL_STATE?.reports, DEMO_REPORTS));
  const initialEntries = getInitialArray(LOCAL_STATE?.entries, DEMO_ENTRIES);
  const initialTemplateSheets = syncTemplateSheetsWithAllReportEntries(
    deduplicateTemplateSheets(getInitialArray(LOCAL_STATE?.templateSheets, [])),
    initialReports,
    initialEntries
  );

  return ({
  reports: initialReports,
  entries: initialEntries,
  targets: initialTargets,
  periodTargets: initialPeriodTargets,
  templateSheets: initialTemplateSheets,
  users: initialUsers,
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
    const sourceReport = getSourceReport(reportDate, options);
    const sourceEntries = sourceReport ? get().getEntriesByReport(sourceReport.id) : [];

    if (existing) {
      const missingEntries = buildMissingEntries(existing.id, sourceEntries);
      if (missingEntries.length > 0) {
        set(state => ({
          entries: [...state.entries, ...missingEntries],
        }));
        persistCurrentState(true, () => upsertSupabaseRows('production_entries', missingEntries));
      }
      return existing;
    }

    const newReport: ProductionReport = {
      id: genId(),
      report_date: reportDate,
      next_plan_date: getPlanDateFromActualDate(reportDate),
      status: 'collecting',
      created_by: get().currentUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newEntries = buildMissingEntries(newReport.id, sourceEntries);

    set(state => ({
      reports: [...state.reports, newReport],
      entries: [...state.entries, ...newEntries],
    }));
    persistCurrentState(true, async () => {
      await upsertSupabaseRows('production_reports', newReport);
      await upsertSupabaseRows('production_entries', newEntries);
    });

    return newReport;
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

    let savedEntry: ProductionEntry;
    if (existing) {
      savedEntry = {
        ...existing,
        ...entryData,
        submit_status: existing.submit_status === 'submitted' || existing.submit_status === 'approved'
          ? existing.submit_status
          : 'saved',
        updated_at: now,
      };
      set(state => {
        const nextEntries = state.entries.map(e =>
          e.id === existing.id ? savedEntry : e
        );

        return {
          entries: nextEntries,
          templateSheets: syncTemplateSheetsWithReportEntries(
            state.templateSheets,
            state.reports,
            nextEntries,
            savedEntry.report_id
          ),
        };
      });
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
      savedEntry = newEntry;
      set(state => {
        const nextEntries = [...state.entries, newEntry];

        return {
          entries: nextEntries,
          templateSheets: syncTemplateSheetsWithReportEntries(
            state.templateSheets,
            state.reports,
            nextEntries,
            savedEntry.report_id
          ),
        };
      });
    }
    persistCurrentState(true, () => saveSupabaseReportState(getPersistedState()));
  },

  submitEntry: (entryId) => {
    let updatedEntry: ProductionEntry | undefined;
    set(state => ({
      entries: state.entries.map(e => {
        if (e.id !== entryId) return e;

        updatedEntry = {
          ...e,
          submit_status: 'submitted',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return updatedEntry;
      }),
    }));
    persistCurrentState(
      true,
      updatedEntry ? () => upsertSupabaseRows('production_entries', updatedEntry) : undefined
    );
  },

  returnEntry: (entryId) => {
    let updatedEntry: ProductionEntry | undefined;
    set(state => ({
      entries: state.entries.map(e => {
        if (e.id !== entryId) return e;

        updatedEntry = {
          ...e,
          submit_status: 'returned',
          updated_at: new Date().toISOString(),
        };
        return updatedEntry;
      }),
    }));
    persistCurrentState(
      true,
      updatedEntry ? () => upsertSupabaseRows('production_entries', updatedEntry) : undefined
    );
  },

  approveEntry: (entryId) => {
    let updatedEntry: ProductionEntry | undefined;
    set(state => ({
      entries: state.entries.map(e => {
        if (e.id !== entryId) return e;

        updatedEntry = {
          ...e,
          submit_status: 'approved',
          updated_at: new Date().toISOString(),
        };
        return updatedEntry;
      }),
    }));
    persistCurrentState(
      true,
      updatedEntry ? () => upsertSupabaseRows('production_entries', updatedEntry) : undefined
    );
  },

  getTargets: () => get().targets,

  updateTarget: (equipment, shift, productTarget, billetTarget) => {
    let updatedTarget: EquipmentTarget | undefined;
    set(state => ({
      targets: state.targets.map(t => {
        if (t.equipment !== equipment || t.shift !== shift) return t;

        updatedTarget = { ...t, product_target: productTarget, billet_target: billetTarget };
        return updatedTarget;
      }),
    }));
    persistCurrentState(
      true,
      updatedTarget ? () => upsertSupabaseRows('equipment_targets', updatedTarget) : undefined
    );
  },

  getPeriodTargets: () => get().periodTargets,

  updatePeriodTarget: (period, productTarget, billetTarget) => {
    let updatedTarget: ProductionPeriodTarget | undefined;
    set(state => ({
      periodTargets: state.periodTargets.map(target => {
        if (target.period !== period) return target;

        updatedTarget = { ...target, product_target: productTarget, billet_target: billetTarget };
        return updatedTarget;
      }),
    }));
    persistCurrentState(
      true,
      updatedTarget ? () => upsertSupabaseRows('production_period_targets', updatedTarget) : undefined
    );
  },

  getTemplateSheets: () => get().templateSheets,

  updateTemplateWorkbookCell: (sheetId, rowNumber, column, value) => {
    set(state => ({
      templateSheets: updateTemplateWorkbookCell(state.templateSheets, sheetId, rowNumber, column, value),
    }));
    persistCurrentState(true, () => saveSupabaseReportState(getPersistedState()));
  },

  deleteTemplateWorkbookRow: (sheetId, rowNumber) => {
    set(state => ({
      templateSheets: deleteTemplateWorkbookRow(state.templateSheets, sheetId, rowNumber),
    }));
    persistCurrentState(true, () => saveSupabaseReportState(getPersistedState()));
  },

  addTemplateWorkbookRow: (sheetId) => {
    set(state => ({
      templateSheets: addTemplateWorkbookRow(state.templateSheets, sheetId),
    }));
    persistCurrentState(true, () => saveSupabaseReportState(getPersistedState()));
  },

  addMonthlyTemplateSheet: (year, month) => {
    const { templateSheets } = get();
    const newSheetId = `${String(year).slice(-2)}${String(month).padStart(2, '0')}`;

    // 이미 존재하는 월 시트는 추가하지 않음 (id 또는 sheet_name 기준)
    const newSheetName = `${newSheetId}월`;
    if (templateSheets.some(sheet => sheet.id === newSheetId || sheet.sheet_name === newSheetName)) return;

    const newMonthlySheet = createMonthlyTemplateSheet(year, month);
    const annualSheetName = `${year}년 전체`;
    // id 또는 sheet_name으로 연간 시트 존재 여부 확인 (Excel 가져오기 시 id 형식이 다를 수 있음)
    const hasAnnualSheet = templateSheets.some(
      sheet => sheet.id === annualSheetName || sheet.sheet_name === annualSheetName
    );

    const newSheets = hasAnnualSheet
      ? [...templateSheets, newMonthlySheet]
      : [...templateSheets, newMonthlySheet, createAnnualTemplateSheet(year)];

    // 중복 연간 시트 제거 후 정렬 (monthly 먼저, annual 마지막)
    const deduplicatedSheets = deduplicateTemplateSheets(newSheets);
    const sortedSheets = [...deduplicatedSheets].sort((a, b) => {
      if (a.kind === b.kind) return a.sheet_name.localeCompare(b.sheet_name);
      if (a.kind === 'annual') return 1;
      if (b.kind === 'annual') return -1;
      return 0;
    });

    // 연간 시트 동기화
    syncAnnualTemplateWorkbookInPlace(sortedSheets);

    set({ templateSheets: sortedSheets });
    persistCurrentState(true, () => saveSupabaseReportState(getPersistedState()));
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
    let updatedUser: User | undefined;
    set(state => ({
      users: state.users.map((u): User => {
        if (u.id !== userId) return u;
        if (u.role === 'admin') {
          updatedUser = {
            ...u,
            ...updates,
            role: 'admin',
            can_write: true,
            can_edit: true,
            can_delete: true,
          };
          return updatedUser;
        }
        updatedUser = { ...u, ...updates };
        return updatedUser;
      }),
    }));
    persistCurrentState(
      true,
      updatedUser ? () => upsertSupabaseRows('users', updatedUser) : undefined
    );
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
    persistCurrentState(true, () => upsertSupabaseRows('users', newUser));
  },

  deleteUser: (userId) => {
    const user = get().users.find(u => u.id === userId);
    if (!user || user.role === 'admin') return;

    set(state => ({
      users: state.users.filter(u => u.id !== userId),
      currentUserId: state.currentUserId === userId ? 'user-admin' : state.currentUserId,
    }));
    persistCurrentState(true, () => deleteSupabaseRows('users', userId));
  },

  hydrateStorage: async () => {
    if (get().isHydrating) return;

    const shouldUseLocalCache = !get().hasHydrated;
    const localState = shouldUseLocalCache ? loadLocalReportState() : null;
    if (localState) {
      set(state => {
        const normalizedUsers = normalizeUserDefaults(getInitialArray(localState.users, state.users));
        const normalizedTargets = normalizeTargetDefaults(getInitialArray(localState.targets, state.targets));
        const normalizedPeriodTargets = normalizePeriodTargetDefaults(
          getInitialArray(localState.periodTargets, state.periodTargets)
        );
        const reports = normalizeReports(getInitialArray(localState.reports, state.reports));
        const entries = getInitialArray(localState.entries, state.entries);
        const templateSheets = syncTemplateSheetsWithAllReportEntries(
          deduplicateTemplateSheets(getInitialArray(localState.templateSheets, state.templateSheets)),
          reports,
          entries
        );
        return {
          reports,
          entries,
          targets: normalizedTargets.value,
          periodTargets: normalizedPeriodTargets.value,
          templateSheets,
          users: normalizedUsers.value,
          currentUserId: resolveCurrentUserId(normalizedUsers.value, localState.currentUserId || state.currentUserId),
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
      await remoteWriteQueue.catch(() => undefined);
      const remoteState = await loadSupabaseReportState();
      const hasRemoteData = Boolean(
        remoteState.users?.length ||
        remoteState.reports?.length ||
        remoteState.entries?.length ||
        remoteState.targets?.length ||
        remoteState.periodTargets?.length ||
        remoteState.templateSheets?.length
      );

      if (hasRemoteData) {
        let remoteDefaultsChanged = false;
        let remoteTemplateSheetsSynced = false;
        set(state => {
          const normalizedUsers = normalizeUserDefaults(getInitialArray(remoteState.users, state.users));
          const normalizedTargets = normalizeTargetDefaults(getInitialArray(remoteState.targets, state.targets));
          const normalizedPeriodTargets = normalizePeriodTargetDefaults(
            getInitialArray(remoteState.periodTargets, state.periodTargets)
          );
          remoteDefaultsChanged = normalizedUsers.changed || normalizedTargets.changed || normalizedPeriodTargets.changed;
          const reports = normalizeReports(getInitialArray(remoteState.reports, state.reports));
          const entries = getInitialArray(remoteState.entries, state.entries);
          const templateSheets = deduplicateTemplateSheets(getInitialArray(remoteState.templateSheets, state.templateSheets));
          const syncedTemplateSheets = syncTemplateSheetsWithAllReportEntries(templateSheets, reports, entries);
          remoteTemplateSheetsSynced = syncedTemplateSheets !== templateSheets;

          return {
            reports,
            entries,
            targets: normalizedTargets.value,
            periodTargets: normalizedPeriodTargets.value,
            templateSheets: syncedTemplateSheets,
            users: normalizedUsers.value,
            currentUserId: resolveCurrentUserId(normalizedUsers.value, state.currentUserId),
          };
        });
        if (remoteDefaultsChanged || remoteTemplateSheetsSynced) {
          await saveSupabaseReportState(getPersistedState());
        }
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
