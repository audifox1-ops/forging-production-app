import { test, expect } from '@playwright/test';

test.describe('대시보드', () => {
  test('대시보드 페이지가 로드된다', async ({ page }) => {
    await page.goto('/#/dashboard');
    await expect(page.locator('text=생산 대시보드')).toBeVisible({ timeout: 10000 });
  });

  test('사이드바 네비게이션이 동작한다', async ({ page }) => {
    await page.goto('/#/dashboard');
    await page.click('text=보고서');
    await expect(page.locator('text=보고 이력')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('실적 입력', () => {
  test('실적 입력 페이지가 로드된다', async ({ page }) => {
    await page.goto('/#/dashboard');
    await page.click('text=실적 입력', { timeout: 10000 });
    await expect(page.locator('text=생산실적 입력')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('보고서', () => {
  test('보고서 이력 페이지가 로드된다', async ({ page }) => {
    await page.goto('/#/reports');
    await expect(page.locator('text=보고 이력')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('관리자 페이지', () => {
  test('담당자 관리 페이지가 로드된다', async ({ page }) => {
    await page.goto('/#/admin/users');
    await expect(page.locator('text=담당자 관리')).toBeVisible({ timeout: 10000 });
  });

  test('목표값 관리 페이지가 로드된다', async ({ page }) => {
    await page.goto('/#/admin/targets');
    await expect(page.locator('text=목표값 관리')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('반응형', () => {
  test('모바일 뷰포트에서 사이드바가 접힌다', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/#/dashboard');
    await expect(page.locator('text=생산 대시보드')).toBeVisible({ timeout: 10000 });
  });
});
