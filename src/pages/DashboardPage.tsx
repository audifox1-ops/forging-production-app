import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock,
  Printer, PlusCircle, RefreshCw, Users,
} from 'lucide-react';
import { useReportStore } from '../store/reportStore';
import { useAuthStore } from '../store/authStore';
import { calcDashboardSummary, formatNumber, getAchievementStatus } from '../utils/calculations';
import { getKPIStatusText } from '../utils/reportTextGenerator';
import KPIStatusCard from '../components/KPIStatusCard';
import SubmitStatusBadge from '../components/SubmitStatusBadge';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { reports, getEntriesByReport, createReport } = useReportStore();
  const [selectedDate, setSelectedDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));

  const report = reports.find(r => r.report_date === selectedDate);
  const entries = report ? getEntriesByReport(report.id) : [];
  const summary = calcDashboardSummary(entries);

  const handleCreateReport = () => {
    createReport(selectedDate);
  };

  const handleGoInput = () => {
    navigate(`/reports/${selectedDate}/input`);
  };

  const handlePrint = () => {
    navigate(`/reports/${selectedDate}/print`);
  };

  // 차트용 데이터
  const equipmentChartData = summary.by_equipment.map(eq => ({
    name: eq.equipment,
    '제품 계획': eq.product_plan,
    '제품 실적': eq.product_actual,
    '황지 계획': eq.billet_plan,
    '황지 실적': eq.billet_actual,
  }));

  const achievementChartData = summary.by_equipment.map(eq => ({
    name: eq.equipment,
    '제품 달성율': eq.product_achievement_rate,
    '황지 달성율': eq.billet_achievement_rate,
  }));

  const shiftChartData = summary.by_shift.map(s => ({
    name: s.shift,
    '제품 계획': s.product_plan,
    '제품 실적': s.product_actual,
    '황지 계획': s.billet_plan,
    '황지 실적': s.billet_actual,
  }));

  return (
    <div className="space-y-6 fade-in">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">생산 대시보드</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(selectedDate), 'yyyy년 MM월 dd일 (eee)', { locale: ko })} 기준
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="form-input w-auto"
          />
          {!report ? (
            <button onClick={handleCreateReport} className="btn-primary flex items-center gap-2">
              <PlusCircle size={16} />
              보고서 생성
            </button>
          ) : (
            <>
              <button onClick={handleGoInput} className="btn-secondary flex items-center gap-2">
                <RefreshCw size={16} />
                실적 입력
              </button>
              <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
                <Printer size={16} />
                보고서 출력
              </button>
            </>
          )}
        </div>
      </div>

      {!report ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <AlertTriangle className="mx-auto mb-3 text-yellow-400" size={40} />
            <p className="text-gray-600">해당 날짜의 보고서가 없습니다.</p>
            <button onClick={handleCreateReport} className="btn-primary mt-4">
              오늘 보고서 생성
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 보고서 상태 배너 */}
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-2">
              {report.status === 'closed' ? (
                <CheckCircle size={18} className="text-green-600" />
              ) : (
                <Clock size={18} className="text-blue-600" />
              )}
              <span className="font-medium text-blue-800">
                보고서 상태:{' '}
                <span className={report.status === 'closed' ? 'text-green-700' : 'text-blue-700'}>
                  {report.status === 'draft' ? '작성중' :
                    report.status === 'collecting' ? '입력중' :
                      report.status === 'submitted' ? '제출완료' :
                        report.status === 'reviewed' ? '검토완료' : '마감'}
                </span>
              </span>
            </div>
            <div className="ml-auto text-sm text-blue-600">
              제출: {summary.submit_status_count.submitted}/{summary.submit_status_count.total}명 ·
              미입력: {summary.submit_status_count.not_started}명
            </div>
          </div>

          {/* KPI 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPIStatusCard
              title="전체 달성율"
              value={`${summary.total_achievement_rate.toFixed(1)}%`}
              rate={summary.total_achievement_rate}
              subtitle={`${formatNumber(summary.total_actual)} / ${formatNumber(summary.total_plan)} KG`}
            />
            <KPIStatusCard
              title="제품 달성율"
              value={`${summary.product_achievement_rate.toFixed(1)}%`}
              rate={summary.product_achievement_rate}
              subtitle={`${formatNumber(summary.total_product_actual)} / ${formatNumber(summary.total_product_plan)} KG`}
            />
            <KPIStatusCard
              title="황지 달성율"
              value={`${summary.billet_achievement_rate.toFixed(1)}%`}
              rate={summary.billet_achievement_rate}
              subtitle={`${formatNumber(summary.total_billet_actual)} / ${formatNumber(summary.total_billet_plan)} KG`}
            />
            <KPIStatusCard
              title="총 미달량"
              value={`${formatNumber(summary.total_shortfall)} KG`}
              rate={summary.total_shortfall === 0 ? 100 : summary.total_achievement_rate}
              subtitle={summary.total_shortfall === 0 ? '미달 없음' : '만회 필요'}
              invertColor
            />
            <KPIStatusCard
              title="제출완료"
              value={`${summary.submit_status_count.submitted}명`}
              rate={summary.submit_status_count.total > 0
                ? (summary.submit_status_count.submitted / summary.submit_status_count.total) * 100
                : 0}
              subtitle={`전체 ${summary.submit_status_count.total}명`}
            />
            <KPIStatusCard
              title="미입력"
              value={`${summary.submit_status_count.not_started}명`}
              rate={summary.submit_status_count.not_started === 0 ? 100 : 50}
              subtitle="입력 필요"
              invertColor
            />
          </div>

          {/* 차트 섹션 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 설비별 목표/실적 */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-800">설비별 목표 대비 실적</h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={equipmentChartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v.toLocaleString()} KG`} />
                    <Legend />
                    <Bar dataKey="제품 계획" fill="#93c5fd" />
                    <Bar dataKey="제품 실적" fill="#2563eb" />
                    <Bar dataKey="황지 계획" fill="#fcd34d" />
                    <Bar dataKey="황지 실적" fill="#d97706" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 설비별 달성율 */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-800">설비별 달성율 (%)</h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={achievementChartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 120]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Legend />
                    <Bar dataKey="제품 달성율" radius={[4, 4, 0, 0]}>
                      {achievementChartData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={
                            entry['제품 달성율'] >= 100 ? '#16a34a' :
                              entry['제품 달성율'] >= 90 ? '#d97706' : '#dc2626'
                          }
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="황지 달성율" radius={[4, 4, 0, 0]}>
                      {achievementChartData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={
                            entry['황지 달성율'] >= 100 ? '#4ade80' :
                              entry['황지 달성율'] >= 90 ? '#fbbf24' : '#f87171'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 주간/야간 실적 */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-800">근무조별 실적</h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={shiftChartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v.toLocaleString()} KG`} />
                    <Legend />
                    <Bar dataKey="제품 계획" fill="#93c5fd" />
                    <Bar dataKey="제품 실적" fill="#2563eb" />
                    <Bar dataKey="황지 계획" fill="#fcd34d" />
                    <Bar dataKey="황지 실적" fill="#d97706" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 담당자별 입력 현황 */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Users size={16} />
                  담당자별 입력 현황
                </h3>
              </div>
              <div className="card-body p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-2.5 text-left text-gray-600 font-medium">담당자</th>
                      <th className="px-4 py-2.5 text-center text-gray-600 font-medium">설비</th>
                      <th className="px-4 py-2.5 text-center text-gray-600 font-medium">근무조</th>
                      <th className="px-4 py-2.5 text-center text-gray-600 font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entries.map(entry => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-700">{entry.user_name || '-'}</td>
                        <td className="px-4 py-2.5 text-center font-medium">{entry.equipment}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{entry.shift}</td>
                        <td className="px-4 py-2.5 text-center">
                          <SubmitStatusBadge status={entry.submit_status} />
                        </td>
                      </tr>
                    ))}
                    {entries.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                          입력 데이터가 없습니다
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 상세 실적 테이블 */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-800">설비별 상세 실적</h3>
              <div className="flex gap-2">
                {report.status !== 'closed' && (
                  <button
                    onClick={() => useReportStore.getState().updateReportStatus(report.id, 'closed')}
                    className="btn-danger text-sm px-3 py-1.5"
                  >
                    마감 처리
                  </button>
                )}
                <button onClick={handlePrint} className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5">
                  <Printer size={14} />
                  출력
                </button>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="production-table w-full">
                <thead>
                  <tr>
                    <th className="px-3 py-2.5" rowSpan={2}>설비</th>
                    <th className="px-3 py-2.5" rowSpan={2}>근무조</th>
                    <th className="px-3 py-2.5 text-center" colSpan={4}>제품 (KG)</th>
                    <th className="px-3 py-2.5 text-center" colSpan={4}>황지 (KG)</th>
                    <th className="px-3 py-2.5" rowSpan={2}>주요 사유</th>
                    <th className="px-3 py-2.5" rowSpan={2}>상태</th>
                  </tr>
                  <tr>
                    <th className="px-3 py-2">계획</th>
                    <th className="px-3 py-2">실적</th>
                    <th className="px-3 py-2">달성율</th>
                    <th className="px-3 py-2">미달량</th>
                    <th className="px-3 py-2">계획</th>
                    <th className="px-3 py-2">실적</th>
                    <th className="px-3 py-2">달성율</th>
                    <th className="px-3 py-2">미달량</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => {
                    const pRate = entry.product_plan > 0 ? (entry.product_actual / entry.product_plan * 100) : null;
                    const bRate = entry.billet_plan > 0 ? (entry.billet_actual / entry.billet_plan * 100) : null;
                    const pShortfall = Math.max(0, (entry.product_plan || 0) - (entry.product_actual || 0));
                    const bShortfall = Math.max(0, (entry.billet_plan || 0) - (entry.billet_actual || 0));
                    const hasShortfall = pShortfall > 0 || bShortfall > 0;

                    return (
                      <tr key={entry.id} className={hasShortfall && entry.submit_status !== 'not_started' ? 'shortfall-row' : ''}>
                        <td className="text-center-cell font-bold">{entry.equipment}</td>
                        <td className="text-center-cell">{entry.shift}</td>
                        <td>{formatNumber(entry.product_plan)}</td>
                        <td className={`font-medium ${pRate !== null && pRate < 90 ? 'text-red-600' : ''}`}>
                          {formatNumber(entry.product_actual)}
                        </td>
                        <td className={`text-center-cell font-semibold ${
                          pRate === null ? 'text-gray-400' :
                            pRate >= 100 ? 'text-green-600' :
                              pRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {pRate !== null ? `${pRate.toFixed(1)}%` : '-'}
                        </td>
                        <td className={pShortfall > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                          {pShortfall > 0 ? `▼ ${formatNumber(pShortfall)}` : '-'}
                        </td>
                        <td>{formatNumber(entry.billet_plan)}</td>
                        <td className={`font-medium ${bRate !== null && bRate < 90 ? 'text-red-600' : ''}`}>
                          {formatNumber(entry.billet_actual)}
                        </td>
                        <td className={`text-center-cell font-semibold ${
                          bRate === null ? 'text-gray-400' :
                            bRate >= 100 ? 'text-green-600' :
                              bRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {bRate !== null ? `${bRate.toFixed(1)}%` : '-'}
                        </td>
                        <td className={bShortfall > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                          {bShortfall > 0 ? `▼ ${formatNumber(bShortfall)}` : '-'}
                        </td>
                        <td className="text-center-cell text-xs">
                          {entry.reason_category || <span className="text-gray-300">-</span>}
                        </td>
                        <td className="text-center-cell">
                          <SubmitStatusBadge status={entry.submit_status} />
                        </td>
                      </tr>
                    );
                  })}

                  {/* 합계 행 */}
                  <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                    <td colSpan={2} className="text-center-cell">합 계</td>
                    <td>{formatNumber(summary.total_product_plan)}</td>
                    <td>{formatNumber(summary.total_product_actual)}</td>
                    <td className={`text-center-cell ${
                      summary.product_achievement_rate >= 100 ? 'text-green-600' :
                        summary.product_achievement_rate >= 90 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {summary.product_achievement_rate.toFixed(1)}%
                    </td>
                    <td className="text-red-600">
                      {summary.total_product_plan - summary.total_product_actual > 0
                        ? `▼ ${formatNumber(summary.total_product_plan - summary.total_product_actual)}`
                        : '-'}
                    </td>
                    <td>{formatNumber(summary.total_billet_plan)}</td>
                    <td>{formatNumber(summary.total_billet_actual)}</td>
                    <td className={`text-center-cell ${
                      summary.billet_achievement_rate >= 100 ? 'text-green-600' :
                        summary.billet_achievement_rate >= 90 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {summary.billet_achievement_rate.toFixed(1)}%
                    </td>
                    <td className="text-red-600">
                      {summary.total_billet_plan - summary.total_billet_actual > 0
                        ? `▼ ${formatNumber(summary.total_billet_plan - summary.total_billet_actual)}`
                        : '-'}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 미달성 사유 및 만회대책 섹션 */}
          {entries.some(e => e.reason_category && e.submit_status === 'submitted') && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-800">미달성 사유 및 만회대책</h3>
              </div>
              <div className="card-body space-y-4">
                {entries
                  .filter(e => e.reason_category && e.submit_status === 'submitted')
                  .map(entry => (
                    <div key={entry.id} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={16} className="text-orange-500" />
                        <span className="font-semibold text-orange-800">
                          {entry.equipment} / {entry.shift} — {entry.reason_category}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {entry.reason_detail && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1 font-medium">상세 원인</div>
                            <div className="text-gray-700">{entry.reason_detail}</div>
                          </div>
                        )}
                        {entry.action_today && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1 font-medium">금일 조치사항</div>
                            <div className="text-gray-700">{entry.action_today}</div>
                          </div>
                        )}
                        {entry.recovery_plan && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1 font-medium">익일 만회계획</div>
                            <div className="text-gray-700">{entry.recovery_plan}</div>
                          </div>
                        )}
                        {entry.support_request && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1 font-medium">지원 요청사항</div>
                            <div className="text-gray-700 text-orange-700">{entry.support_request}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
