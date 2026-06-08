import React, { useState } from 'react';
import { useReportStore } from '../store/reportStore';
import { EQUIPMENT_LIST, SHIFT_LIST, User, UserRole, Equipment, Shift } from '../types';
import { Plus, Edit2, Save, X } from 'lucide-react';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: '관리자',
  manager: '매니저',
  user: '담당자',
  viewer: '조회자',
};

export default function UserManagementPage() {
  const { users, updateUser, addUser } = useReportStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editData, setEditData] = useState<Partial<User>>({});
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    employee_no: '',
    role: 'user' as UserRole,
    assigned_equipment: [] as Equipment[],
    assigned_shift: null as Shift | null,
  });

  const handleEdit = (user: User) => {
    setEditingId(user.id);
    setEditData({ ...user });
  };

  const handleSave = () => {
    if (editingId) {
      updateUser(editingId, editData);
      setEditingId(null);
      setEditData({});
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email) return;
    addUser(newUser);
    setShowAddForm(false);
    setNewUser({
      name: '',
      email: '',
      employee_no: '',
      role: 'user',
      assigned_equipment: [],
      assigned_shift: null,
    });
  };

  const toggleEquipment = (data: any, setData: any, eq: Equipment) => {
    const current = data.assigned_equipment || [];
    const updated = current.includes(eq)
      ? current.filter((e: Equipment) => e !== eq)
      : [...current, eq];
    setData((prev: any) => ({ ...prev, assigned_equipment: updated }));
  };

  return (
    <div className="space-y-5 fade-in max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">담당자 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">사용자 계정 및 설비 배정을 관리합니다</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          담당자 추가
        </button>
      </div>

      {/* 추가 폼 */}
      {showAddForm && (
        <div className="card border-blue-200">
          <div className="card-header bg-blue-50">
            <h3 className="font-semibold text-blue-800">새 담당자 추가</h3>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">이름</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
                  className="form-input"
                  placeholder="홍길동"
                />
              </div>
              <div>
                <label className="form-label">이메일</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                  className="form-input"
                  placeholder="user@forging.com"
                />
              </div>
              <div>
                <label className="form-label">사번</label>
                <input
                  type="text"
                  value={newUser.employee_no}
                  onChange={e => setNewUser(p => ({ ...p, employee_no: e.target.value }))}
                  className="form-input"
                  placeholder="10007"
                />
              </div>
              <div>
                <label className="form-label">권한</label>
                <select
                  value={newUser.role}
                  onChange={e => setNewUser(p => ({ ...p, role: e.target.value as UserRole }))}
                  className="form-select"
                >
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">담당 설비</label>
                <div className="flex gap-2 mt-1">
                  {EQUIPMENT_LIST.map(eq => (
                    <button
                      key={eq}
                      type="button"
                      onClick={() => toggleEquipment(newUser, setNewUser, eq)}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        (newUser.assigned_equipment || []).includes(eq)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {eq}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">담당 근무조</label>
                <div className="flex gap-2 mt-1">
                  {[...SHIFT_LIST, null as any].map(shift => (
                    <button
                      key={shift || 'all'}
                      type="button"
                      onClick={() => setNewUser(p => ({ ...p, assigned_shift: shift }))}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        newUser.assigned_shift === shift
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {shift || '전체'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddForm(false)} className="btn-secondary">취소</button>
              <button onClick={handleAddUser} className="btn-primary">추가</button>
            </div>
          </div>
        </div>
      )}

      {/* 사용자 목록 */}
      <div className="card">
        <div className="table-wrapper">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-gray-600 font-semibold">이름</th>
                <th className="px-4 py-3 text-left text-gray-600 font-semibold">이메일</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">사번</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">권한</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">담당 설비</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">담당 근무조</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(user => {
                const isEditing = editingId === user.id;
                return (
                  <tr key={user.id} className={`hover:bg-gray-50 ${isEditing ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData.name || ''}
                          onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                          className="form-input text-sm py-1"
                        />
                      ) : user.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {isEditing ? (
                        <input
                          type="email"
                          value={editData.email || ''}
                          onChange={e => setEditData(p => ({ ...p, email: e.target.value }))}
                          className="form-input text-sm py-1"
                        />
                      ) : user.email}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{user.employee_no}</td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <select
                          value={editData.role || 'user'}
                          onChange={e => setEditData(p => ({ ...p, role: e.target.value as UserRole }))}
                          className="form-select text-sm py-1"
                        >
                          {Object.entries(ROLE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`badge ${
                          user.role === 'admin' ? 'badge-blue' :
                            user.role === 'manager' ? 'badge-normal' :
                              user.role === 'viewer' ? 'badge-gray' : 'badge-warning'
                        }`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <div className="flex gap-1 justify-center">
                          {EQUIPMENT_LIST.map(eq => (
                            <button
                              key={eq}
                              type="button"
                              onClick={() => toggleEquipment(editData, setEditData, eq)}
                              className={`px-2 py-0.5 rounded text-xs font-medium border ${
                                (editData.assigned_equipment || []).includes(eq)
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-gray-600 border-gray-300'
                              }`}
                            >
                              {eq}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-center">
                          {user.assigned_equipment.map(eq => (
                            <span key={eq} className="badge badge-blue">{eq}</span>
                          ))}
                          {user.assigned_equipment.length === 0 && <span className="text-gray-400">-</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <div className="flex gap-1 justify-center">
                          {([...SHIFT_LIST, null] as any[]).map(shift => (
                            <button
                              key={shift || 'all'}
                              type="button"
                              onClick={() => setEditData(p => ({ ...p, assigned_shift: shift }))}
                              className={`px-2 py-0.5 rounded text-xs font-medium border ${
                                editData.assigned_shift === shift
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-gray-600 border-gray-300'
                              }`}
                            >
                              {shift || '전체'}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-600">{user.assigned_shift || '전체'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-center">
                        {isEditing ? (
                          <>
                            <button onClick={handleSave} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                              <Save size={15} />
                            </button>
                            <button onClick={handleCancel} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                              <X size={15} />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => handleEdit(user)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Edit2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
