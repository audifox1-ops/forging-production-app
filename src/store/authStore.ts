import { create } from 'zustand';
import { User } from '../types';
import { DEMO_USERS, DEMO_PASSWORDS } from '../lib/mockData';

interface AuthState {
  currentUser: User | null;
  isLoading: boolean;
  login: (emailOrEmpNo: string, password: string) => Promise<boolean>;
  logout: () => void;
}

// localStorage에서 세션 복구
const savedUser = localStorage.getItem('forging_user');

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: savedUser ? JSON.parse(savedUser) : null,
  isLoading: false,

  login: async (emailOrEmpNo: string, password: string): Promise<boolean> => {
    set({ isLoading: true });
    await new Promise(r => setTimeout(r, 500)); // 로딩 시뮬레이션

    // 데모 모드 로그인
    const storedPassword = DEMO_PASSWORDS[emailOrEmpNo];
    if (!storedPassword || storedPassword !== password) {
      set({ isLoading: false });
      return false;
    }

    const user = DEMO_USERS.find(
      u => u.email === emailOrEmpNo || u.employee_no === emailOrEmpNo
    );

    if (user) {
      localStorage.setItem('forging_user', JSON.stringify(user));
      set({ currentUser: user, isLoading: false });
      return true;
    }

    set({ isLoading: false });
    return false;
  },

  logout: () => {
    localStorage.removeItem('forging_user');
    set({ currentUser: null });
  },
}));
