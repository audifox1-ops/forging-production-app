# 전일 계획 이월 방식 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task after approval. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전일 계획을 직전 보고서의 금일 예상에서 안전하게 이월하고, 자동 이월 값만 후속 수정에 따라 갱신하며, 사람이 수정한 계획과 미입력 상태를 보존한다.

**Architecture:** `production_entries.plan_source`를 기준으로 자동 이월과 수동 계획을 구분한다. 보고서 생성 시 가장 가까운 직전 보고서만 참조하고, 그 보고서의 예상이 비어 있으면 과거 보고서로 재탐색하지 않는다. 이후 금일 예상 저장 시 `plan_source='carried'`인 미마감 후속 보고서만 갱신하며, 수동 계획이나 마감 보고서는 건드리지 않는다.

**Tech Stack:** React + TypeScript + Zustand + Vitest + Supabase/PostgREST + PostgreSQL SQL migration files.

**Spec:** 사용자 요청문서 「생산일보 앱 — 전일 계획 이월 방식 개선」.

## Global Constraints

- 승인 전에는 구현·SQL 생성·커밋·PR을 진행하지 않는다.
- 작업 브랜치는 `fix/plan-carryover`이며 `main`에 직접 push하지 않는다.
- SQL은 `sql/` 폴더에 파일로만 생성하고, 실행은 사용자가 수동으로 한다.
- 기존 `product_plan`, `billet_plan`, `next_product_plan`, `next_billet_plan` 컬럼의 의미와 이름을 바꾸지 않는다.
- 공유 DB의 기존 컬럼과 기존 forging-app 조회 흐름을 깨지 않는 additive migration만 사용한다.
- 구현은 계산 로직 커밋과 화면 표시 커밋으로 분리한다.
- 달성률 분모 계산은 변경하지 않는다.

## Review Focus

- 직전 보고서가 존재하지만 금일 예상이 0/미입력인 경우 더 이전 보고서 값으로 되돌아가지 않는지 — 생성 테스트와 경고 테스트로 고정한다.
- 제품 계획과 황지 계획 중 하나만 사람이 수정한 경우 한 행의 `manual` 판정이 두 값을 자동 갱신하지 않도록 보존하는지 — 양 필드 테스트로 고정한다.
- 후속 보고서가 `reviewed` 또는 기존 DB의 `closed_at` 상태인 경우 원본 예상 수정이 전혀 전파되지 않는지 — 마감 잠금 테스트로 고정한다.
- 기존 행 분류에서 직전 예상과 계획이 같을 때만 `carried`, 다르면 `manual`이 되는지 — SQL backfill 검증 쿼리와 테스트 fixture로 고정한다.
- 기존 forging-app이 새 컬럼 없이 insert/upsert해도 기존 계획 컬럼과 기본값으로 정상 동작하는지 — nullable/default 및 기존 컬럼 보존을 migration review에서 확인한다.

---

## 조사 결과 — 구현 전 승인 필요

### 현재 이월 로직

- `src/store/reportStore.ts:286-294`의 `getSourceReport()`가 `report_date < 새 보고서 날짜`인 보고서 중 날짜가 가장 가까운 하나를 선택한다. `ReportHistoryPage`에서 명시적으로 복사할 때만 `sourceReportDate`가 우선된다.
- `src/store/reportStore.ts:380-415`의 `createReport()`가 선택한 직전 보고서의 entries를 읽고 새 entries를 만든다.
- `src/store/reportStore.ts:300-330`의 `buildDefaultEntry()`가 source entry가 있으면 `next_product_plan`/`next_billet_plan`을 새 `product_plan`/`billet_plan`으로 복사한다. source entry가 없을 때는 설비 목표값을 사용한다.
- 현재는 복사 시점의 snapshot만 저장한다. 이후 source의 `next_*`가 바뀌어도 후속 entry의 `product_plan`/`billet_plan`을 찾거나 갱신하는 로직이 없다.
- source report가 실제로 없으면 현재 로직은 더 이전에 존재하는 보고서를 선택할 수 있다. source report가 존재하지만 예상값이 0이면 더 이전 값으로 재탐색하지 않고 0을 복사한다. 문제 사례의 9/28 값 재사용은 생성 시점에 9/29 report가 아직 없었거나 source 선택 대상에서 빠진 경우에 발생할 수 있다.
- `src/types.ts:50-75`의 `ProductionEntry`에는 계획 출처 필드가 없고, `supabase/schema.sql:35-60`의 `production_entries`에도 없다. 운영 DB도 현재 `plan_source` 컬럼이 없다.
- `src/pages/UserInputPage.tsx:179-185`는 권한과 hydration 완료 후 보고서가 없으면 자동으로 `createReport(actualDate)`를 호출하므로, 이 경로에도 동일한 이월 규칙이 적용되어야 한다.
- `src/pages/UserInputPage.tsx:738-805`는 전일 계획과 금일 계획을 모두 편집 가능하게 하며, 현재 입력 변경 시 출처를 기록하지 않는다.

### 실제 운영 데이터 확인

- 운영 DB의 2026-09-29 P15 주간 `next_product_plan`은 37,036이고, 2026-09-30 P15 주간 `product_plan`은 213,615로 남아 있다. 이는 9/29 예상 수정이 9/30 전일 계획에 반영되지 않은 사례와 일치한다.
- 2026-09-30의 금일 예상이 존재하는데도 2026-10-01 `product_plan`이 0인 행들이 있어, 보고서 생성 시점 snapshot 복사와 후속 전파 부재가 함께 확인된다.
- 현재 운영 보고서 상태는 대부분 `collecting`이며 `reviewed` 1건, `closed_at` 기록 0건이다. 따라서 구현에서는 `reviewed`와 `closed_at != null`을 모두 마감/잠금으로 취급한다.

### 달성률의 현행 동작 — 변경하지 않음

- `src/utils/calculations.ts:94-109`의 일반 `calcDashboardSummary()`는 `product_plan`/`billet_plan`을 분모로 사용한다. 따라서 보고서 이력·비일간 집계에서는 사람이 수정한 계획이 현행 분모에 반영된다.
- `src/pages/DashboardPage.tsx:180-205`의 일간 대시보드는 일일 목표값을 분모로 사용하고, `src/pages/AdminReportPage.tsx`의 전체 요약도 target-based summary를 사용한다. 화면별 현행 차이는 이번 작업에서 통일하지 않는다.

### 공유 앱 호환성

- 이 저장소의 `src/store/persistence.ts:254-265`는 `production_entries`를 `select('*')`로 읽으므로 새 nullable/default 컬럼은 읽기 호환된다.
- 기존 컬럼과 제약은 유지하고 새 컬럼만 추가하면, 새 컬럼을 모르는 forging-app의 기존 조회·기존 필드 upsert와 충돌하지 않는 방향이다. 다만 실제 forging-app 소스가 이 저장소에 없으므로 해당 앱의 strict DTO/전체행 replace 여부는 PR 전에 사용자 확인이 필요하다.

## 승인 후 설계

### 데이터 모델

권장안은 `plan_source`를 `carried | manual | unavailable` 3상태로 추가하는 것이다.

- `carried`: 직전 보고서의 금일 예상으로 자동 이월됐고, 사람이 전일 계획을 수정하지 않았으므로 원본 예상 변경을 따라갈 수 있다.
- `manual`: 사람이 전일 계획을 수정했으므로 원본 예상 변경으로 덮어쓰지 않는다.
- `unavailable`: 직전 보고서는 있으나 금일 예상이 미입력/0이라 자동 이월할 값이 없었다. 계획은 0/빈 상태로 두고 경고를 표시하며, 사용자가 입력하면 `manual`로 바꾼다.

사용자가 `carried | manual` 2상태만 원하면 `unavailable`을 `carried`로 합칠 수 있지만, 그러면 “자동으로 값을 가져온 상태”와 “가져올 값이 없었던 상태”를 DB에서 구분할 수 없다. 이 보고서는 3상태를 권장한다.

제품과 황지 중 하나만 수동 수정된 경우에는 단일 `plan_source` 컬럼의 의미를 보수적으로 적용해 해당 entry 전체를 `manual`로 전환한다. 두 값을 독립적으로 자동 갱신해야 한다면 `product_plan_source`/`billet_plan_source` 두 컬럼이 필요하므로 이번 범위에서는 채택하지 않는다.

### 생성 규칙

1. 새 보고서의 직전 report는 `report_date < 새 report_date` 중 가장 가까운 하나만 선택한다.
2. 직전 report가 없으면 현재의 목표값 fallback을 유지할지 별도 승인한다. 권장 기본은 첫 보고서만 기존 목표값 fallback을 유지하고 `manual`로 기록하는 것이다.
3. 직전 report가 있으면 각 설비·조별 source entry를 찾는다.
4. source의 해당 `next_*`가 입력 가능 값이면 새 계획에 복사하고 `plan_source='carried'`로 기록한다.
5. source report는 있으나 해당 예상이 미입력이면 더 이전 report를 검색하지 않고 새 계획을 비워 두며 `unavailable`과 다음 경고를 기록한다.

`직전 보고서(YYYY-MM-DD)의 금일 예상이 아직 입력되지 않았습니다. 전일 계획을 입력하거나 직전 보고서의 금일 예상을 먼저 입력해주세요.`

### 후속 전파 규칙

- source entry의 `next_product_plan` 또는 `next_billet_plan` 저장 후, source report의 `next_plan_date`와 일치하는 후속 report를 찾는다.
- 후속 entry가 같은 설비·조이고 `plan_source='carried'`이며 후속 report가 `reviewed`가 아니고 `closed_at`도 없을 때만 계획을 갱신한다.
- 후속 entry가 `manual`이면 그대로 보존하고, 화면에 `전일 예상 X → 계획 Y (변경됨)`을 표시한다.
- 후속 report가 마감 상태면 source 예상 변경을 전파하지 않는다.
- 전파는 상태 변경과 Supabase upsert를 하나의 저장 흐름에서 처리하되, 원본 source entry 저장 실패 시 후속 전파를 수행하지 않는다.

### 기존 데이터 초기화

새 컬럼의 기본값은 `manual`로 두고, backfill은 각 entry에 대해 가장 가까운 이전 report의 같은 설비·조 entry를 비교한다.

- 이전 예상 두 값과 현재 전일 계획 두 값이 모두 같으면 `carried`.
- 이전 report가 없거나 하나라도 다르면 `manual`.
- 이전 report는 있으나 예상이 미입력인 기존 행은 값 자체만으로는 미입력과 유효한 0을 구분할 수 없으므로 `manual`로 분류하고, 별도 데이터 검토 대상으로 남긴다.

이 초기화 기준은 사용자 제시안 “직전 예상과 같으면 carried, 다르면 manual”을 따른다. `unavailable`을 기존 데이터에 소급할 근거가 없으므로 기존 행에는 사용하지 않는다.

## 승인 후 구현 작업

### Task 1 — 데이터/계산 로직 커밋

**Files:**
- Create: `sql/20261001_plan_carryover.sql` — `BEGIN`/`COMMIT` migration, `plan_source` check/default, existing-row backfill, 실행자가 별도로 실행할 rollback transaction.
- Modify: `src/types.ts:50-75` — `plan_source`와 필요한 `ProductionReport.closed_at` 타입 추가.
- Modify: `src/store/reportStore.ts:286-425, 473-530` — source availability, source tracking, manual detection, 후속 carried-only 전파, 마감 잠금.
- Test: `tests/reportStore.test.ts` 또는 별도 `tests/planCarryover.test.ts` — 아래 5개 시나리오.

**Required tests:**

1. 직전 예상 입력 후 새 보고서 생성: 새 `product_plan`/`billet_plan`이 예상과 같고 `plan_source='carried'`.
2. 직전 예상 나중 수정: carried 후속 계획만 새 예상으로 갱신.
3. 후속 계획 수동 수정: `manual` 전환 후 직전 예상 수정에도 유지.
4. 직전 예상 미입력: 더 이전 report의 값이 사용되지 않고 계획 0/빈 상태와 경고가 생성됨.
5. `reviewed` 또는 `closed_at` 후속 report: 어떤 source 수정에도 계획 불변.

### Task 2 — 화면 표시 커밋

**Files:**
- Modify: `src/pages/UserInputPage.tsx:350-810` — 미입력 이월 경고, manual 변경 표시, source/현재 계획 표시.
- Modify: `src/pages/AdminReportPage.tsx` and `src/pages/ReportHistoryPage.tsx` — 필요 시 출처 배지와 변경 표시를 읽기 화면에도 동일하게 노출.
- Test: `tests/components.test.tsx` 또는 새 `tests/planCarryoverDisplay.test.tsx` — 경고, `carried`, `manual` 표시.

화면 표시만 변경하고 달성률 계산 함수는 수정하지 않는다.

### Task 3 — 검증 및 PR

- `npm test -- --run`
- `npm run build`
- SQL 파일은 실행하지 않고 문법·rollback 짝·기존 컬럼 보존만 검토한다.
- `git diff --check`와 브랜치 상태 확인.
- 계산 로직 커밋과 화면 표시 커밋을 별도로 만들고 `fix/plan-carryover`를 push한다.
- PR을 생성하고 승인 대기한다. 승인 전에는 merge/deploy하지 않는다.

## 승인 질문

1. `plan_source`를 권장안인 `carried | manual | unavailable` 3상태로 진행할까요, 아니면 요청 예시대로 `carried | manual` 2상태로 제한할까요?
2. 직전 예상의 “미입력”을 현재 UI/DB의 값 `0`으로 판정해도 될까요? 현재 `next_*` 컬럼은 NOT NULL 정수이고 빈 입력도 `0`으로 저장되어, 진짜 0 계획과 빈 입력을 구분할 수 없습니다.
3. 첫 보고서(직전 report 없음)는 기존 목표값 fallback을 유지하고 `manual`로 기록하는 안에 동의하시나요?

승인 후 Task 1부터 구현하고, 계산 로직 커밋 → 화면 표시 커밋 → PR 순서로 진행하겠습니다.
