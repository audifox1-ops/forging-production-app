import { describe, expect, it } from 'vitest';
import { getStorageErrorMessage } from '../src/store/persistence';

describe('getStorageErrorMessage', () => {
  it('explains anonymous auth setup failures', () => {
    const message = getStorageErrorMessage(
      new Error('Supabase anonymous sign-in failed: signups not allowed')
    );

    expect(message).toContain('Anonymous Sign-Ins');
    expect(message).toContain('forging-production-app.vercel.app');
  });

  it('explains browser storage blocks', () => {
    const message = getStorageErrorMessage(new Error('localStorage access is denied'));

    expect(message).toContain('forging-production-app.vercel.app');
    expect(message).toContain('사이트 데이터');
  });

  it('explains Supabase permission failures', () => {
    const message = getStorageErrorMessage({
      code: '403',
      message: 'permission denied for table production_reports',
    });

    expect(message).toContain('RLS');
    expect(message).toContain('production_reports');
  });

  it('explains network failures', () => {
    const message = getStorageErrorMessage(new Error('network request failed'));

    expect(message).toContain('Supabase');
    expect(message).toContain('VPN');
  });
});
