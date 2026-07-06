// scripts/migrate-data.mjs
// 생산일보 데이터를 구 Supabase 프로젝트에서 새(Forging Insight) 프로젝트로 복사한다.
//
// 실행 방법:
//   1) .env.migration.example을 복사해 .env.migration을 만들고 키 4개를 채운다
//      (service_role 키는 Supabase Dashboard → Settings → API에서 복사)
//   2) node scripts/migrate-data.mjs
//   3) 마지막에 출력되는 [구 행수 / 새 행수] 비교표가 전부 일치하는지 확인
//
// 안전 장치:
//   - 구 프로젝트에는 읽기만 한다 (삭제·수정 절대 없음)
//   - 새 프로젝트에는 id 기준 upsert — 재실행해도 중복이 생기지 않는다
//   - service_role 키는 이 스크립트에서만 쓰고 프런트 코드에 절대 넣지 않는다

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'

// ---------------------------------------------------------------------------
// .env.migration 로드 (외부 패키지 없이 단순 파싱)
// ---------------------------------------------------------------------------
function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/.exec(line)
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2]
  }
  return out
}

const env = { ...loadEnvFile('.env.migration'), ...process.env }
const need = ['OLD_SUPABASE_URL', 'OLD_SERVICE_ROLE_KEY', 'NEW_SUPABASE_URL', 'NEW_SERVICE_ROLE_KEY']
const missing = need.filter((k) => !env[k])
if (missing.length > 0) {
  console.error(`❌ 환경변수 누락: ${missing.join(', ')}`)
  console.error('   .env.migration.example을 복사해 .env.migration을 만들고 값을 채우세요.')
  process.exit(1)
}
if (env.OLD_SUPABASE_URL === env.NEW_SUPABASE_URL) {
  console.error('❌ OLD와 NEW의 URL이 같습니다. 잘못된 설정입니다.')
  process.exit(1)
}

const oldDb = createClient(env.OLD_SUPABASE_URL, env.OLD_SERVICE_ROLE_KEY)
const newDb = createClient(env.NEW_SUPABASE_URL, env.NEW_SERVICE_ROLE_KEY)

// 참조 무결성(FK) 순서: 부모 → 자식
const TABLES = [
  'users',
  'production_reports',
  'production_entries',
  'equipment_targets',
  'production_period_targets',
  'report_comments',
  'report_status_logs',
]
const PAGE = 1000

// 한 테이블의 전체 행 수를 센다
async function countRows(db, table) {
  const { count, error } = await db.from(table).select('id', { count: 'exact', head: true })
  if (error) throw new Error(`${table} 카운트 실패: ${error.message}`)
  return count ?? 0
}

// 구 → 새로 한 테이블을 1000행 단위로 복사한다 (id 기준 upsert)
async function copyTable(table) {
  let copied = 0
  for (let page = 0; ; page++) {
    const { data, error } = await oldDb
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw new Error(`${table} 읽기 실패: ${error.message}`)
    if (!data || data.length === 0) break

    const { error: upErr } = await newDb.from(table).upsert(data, { onConflict: 'id' })
    if (upErr) throw new Error(`${table} 쓰기 실패(page ${page}): ${upErr.message}`)

    copied += data.length
    process.stdout.write(`\r  ${table}: ${copied}행 복사 중...`)
    if (data.length < PAGE) break
  }
  process.stdout.write('\n')
  return copied
}

// ---------------------------------------------------------------------------
// 메인: 복사 → 검증 비교표
// ---------------------------------------------------------------------------
console.log('=== 생산일보 데이터 이관 시작 ===')
console.log(`구:  ${env.OLD_SUPABASE_URL}`)
console.log(`새:  ${env.NEW_SUPABASE_URL}\n`)

const results = []
let failed = false

for (const table of TABLES) {
  try {
    const oldCount = await countRows(oldDb, table)
    console.log(`■ ${table} (구 프로젝트 ${oldCount}행)`)
    if (oldCount > 0) await copyTable(table)
    const newCount = await countRows(newDb, table)
    const ok = newCount >= oldCount // 새 쪽에 기존 데이터가 더 있어도 허용(재실행 등)
    if (!ok) failed = true
    results.push({ table, old: oldCount, new: newCount, ok })
  } catch (e) {
    failed = true
    results.push({ table, old: '?', new: '?', ok: false, err: String(e.message ?? e) })
    console.error(`  ❌ ${e.message ?? e}`)
  }
}

console.log('\n=== 검증 비교표 (구 행수 → 새 행수) ===')
for (const r of results) {
  const mark = r.ok ? '✅' : '❌'
  console.log(`${mark} ${r.table.padEnd(28)} ${String(r.old).padStart(7)} → ${String(r.new).padStart(7)}${r.err ? '  ' + r.err : ''}`)
}

if (failed) {
  console.error('\n❌ 일부 테이블 이관 실패 — 위 오류를 확인하세요. 재실행해도 안전합니다.')
  process.exit(1)
}
console.log('\n✅ 이관 완료. 이제 앱의 .env / Vercel 환경변수를 새 프로젝트 값으로 교체하세요.')
console.log('   완료 후 .env.migration 파일은 반드시 삭제하세요 (service_role 키 포함).')
