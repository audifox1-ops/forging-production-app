import React, { useState } from 'react';
import { useReportStore } from '../store/reportStore';
import { EQUIPMENT_LIST, SHIFT_LIST, User, Equipment, Shift } from '../types';
import { Plus, Edit2, Save, X, Trash2, ShieldCheck, Lock } from 'lucide-react';

export default function UserManagementPage() {
  const {
    users,
    getCurrentUser,
    updateUser,
    addUser,
    deleteUser,
  } = useReportStore();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const canDeleteUsers = isAdmin || Boolean(currentUser?.can_delete);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editData, setEditData] = useState<Partial<User>>({});
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    employee_no: '',
    role: 'user' as const,
    assigned_equipment: [] as Equipment[],
    assigned_shift: null as Shift | null,
    can_write: false,
    can_edit: false,
    can_delete: false,
  });

  const roleRank: Record<User['role'], number> = {
    admin: 0,
    manager: 1,
    user: 2,
    viewer: 3,
  };
  const getRoleLabel = (user: User) => {
    if (user.role === 'admin') return '관리자';
    if (user.role === 'manager') return '총괄';
    return '담당자';
  };
  const sortedUsers = [...users].sort((a, b) => {
    if (roleRank[a.role] !== roleRank[b.role]) return roleRank[a.role] - roleRank[b.role];
    return a.name.localeCompare(b.name, 'ko-KR');
  });

  const handleEdit = (user: User) => {
    if (!isAdmin) return;
    setEditingId(user.id);
    setEditData({ ...user });
  };

  const handleSave = () => {
    if (!isAdmin || !editingId) return;
    updateUser(editingId, editData);
    setEditingId(null);
    setEditData({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleAddUser = () => {
    if (!isAdmin || !newUser.name || !newUser.email) return;
    addUser(newUser);
    setShowAddForm(false);
    setNewUser({
      name: '',
      email: '',
      employee_no: '',
      role: 'user',
      assigned_equipment: [],
      assigned_shift: null,
      can_write: false,
      can_edit: false,
      can_delete: false,
    });
  };

  const handleDeleteUser = (user: User) => {
    if (!canDeleteUsers || user.role === 'admin') return;
    if (!window.confirm(`${user.name} 계정을 삭제하시겠습니까?`)) return;
    deleteUser(user.id);
  };

  const toggleEquipment = (data: Partial<User>, setData: React.Dispatch<React.SetStateAction<any>>, eq: Equipment) => {
    const current = data.assigned_equipment || [];
    const updated = current.includes(eq)
      ? current.filter((e: Equipment) => e !== eq)
      : [...current, eq];
    setData((prev: any) => ({ ...prev, assigned_equipment: updated }));
  };

  const togglePermission = (
    data: Partial<User>,
    setData: React.Dispatch<React.SetStateAction<any>>,
    field: 'can_write' | 'can_edit' | 'can_delete'
  ) => {
    setData((prev: any) => ({ ...prev, [field]: !data[field] }));
  };

  return (
    <div className="space-y-5 fade-in max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">담당자 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            관리자, 총괄, 담당자 권한을 관리합니다. 쓰기/편집 권한은 관리자 부여 후 활성화됩니다.
          </p>
        </div>
        <button
          onClick={() => isAdmin && setShowAddForm(true)}
          disabled={!isAdmin}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          담당자 추가
        </button>
      </div>

      {!isAdmin && (
        <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
          <Lock size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
          <div>사용자 추가, 정보 수정, 권한 부여는 관리자 계정에서만 가능합니다.</div>
        </div>
      )}

      {showAddForm && isAdmin && (
        <div className="card border-blue-200">
          <div className="card-header bg-blue-50">
            <h3 className="font-semibold text-blue-800">새 담당자 추가</h3>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">이름</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={event => setNewUser(prev => ({ ...prev, name: event.target.value }))}
                  className="form-input"
                  placeholder="홍길동 직급"
                />
              </div>
              <div>
                <label className="form-label">이메일</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={event => setNewUser(prev => ({ ...prev, email: event.target.value }))}
                  className="form-input"
                  placeholder="user@forging.com"
                />
              </div>
              <div>
                <label className="form-label">사번</label>
                <input
                  type="text"
                  value={newUser.employee_no}
                  onChange={event => setNewUser(prev => ({ ...prev, employee_no: event.target.value }))}
                  className="form-input"
                  placeholder="10007"
                />
              </div>
              <div>
                <label className="form-label">담당 설비</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {EQUIPMENT_LIST.map(eq => (
                    <button
                      key={eq}
                      type="button"
                      onClick={() => toggleEquipment(newUser, setNewUser, eq)}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        newUser.assigned_equipment.includes(eq)
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
                  {([...SHIFT_LIST, null] as (Shift | null)[]).map(shift => (
                    <button
                      key={shift || 'all'}
                      type="button"
                      onClick={() => setNewUser(prev => ({ ...prev, assigned_shift: shift }))}
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
              <div>
                <label className="form-label">초기 권한</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {[
                    ['can_write', '쓰기'],
                    ['can_edit', '편집'],
                    ['can_delete', '삭제'],
                  ].map(([field, label]) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => togglePermission(newUser, setNewUser, field as 'can_write' | 'can_edit' | 'can_delete')}
                      className={`px-2.5 py-1 rounded text-xs font-medium border ${
                        newUser[field as 'can_write' | 'can_edit' | 'can_delete']
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-600 border-gray-300'
                      }`}
                    >
                      {label}
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

      <div className="card">
        <div className="table-wrapper">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-gray-600 font-semibold">이름</th>
                <th className="px-4 py-3 text-left text-gray-600 font-semibold">이메일</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">사번</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">계정</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">담당 설비</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">근무조</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">쓰기</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">편집</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">삭제</th>
                <th className="px-4 py-3 text-center text-gray-600 font-semibold">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedUsers.map(user => {
                const isEditing = editingId === user.id;
                const isProtectedAdmin = user.role === 'admin';
                const canDeleteThisUser = canDeleteUsers && !isProtectedAdmin;

                return (
                  <tr key={user.id} className={`hover:bg-gray-50 ${isEditing ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData.name || ''}
                          onChange={event => setEditData(prev => ({ ...prev, name: event.target.value }))}
                          className="form-input text-sm py-1"
                        />
                      ) : user.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {isEditing ? (
                        <input
                          type="email"
                          value={editData.email || ''}
                          onChange={event => setEditData(prev => ({ ...prev, email: event.target.value }))}
                          className="form-input text-sm py-1"
                        />
                      ) : user.email}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData.employee_no || ''}
                          onChange={event => setEditData(prev => ({ ...prev, employee_no: event.target.value }))}
                          className="form-input text-sm py-1 w-24 text-center"
                        />
                      ) : user.employee_no}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${
                        isProtectedAdmin ? 'badge-blue' :
                          user.role === 'manager' ? 'badge-normal' : 'badge-gray'
                      }`}>
                        {getRoleLabel(user)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing && !isProtectedAdmin ? (
                        <div className="flex gap-1 justify-center flex-wrap">
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
                        <div className="flex gap-1 justify-center flex-wrap">
                          {isProtectedAdmin ? (
                            <span className="badge badge-blue">전체</span>
                          ) : (
                            <>
                              {user.assigned_equipment.map(eq => (
                                <span key={eq} className="badge badge-blue">{eq}</span>
                              ))}
                              {user.assigned_equipment.length === 0 && <span className="text-gray-400">-</span>}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing && !isProtectedAdmin ? (
                        <div className="flex gap-1 justify-center">
                          {([...SHIFT_LIST, null] as (Shift | null)[]).map(shift => (
                            <button
                              key={shift || 'all'}
                              type="button"
                              onClick={() => setEditData(prev => ({ ...prev, assigned_shift: shift }))}
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
                        <span className="text-gray-600">{isProtectedAdmin ? '전체' : user.assigned_shift || '전체'}</span>
                      )}
                    </td>
                    {(['can_write', 'can_edit', 'can_delete'] as const).map(field => {
                      const enabled = isProtectedAdmin || Boolean(isEditing ? editData[field] : user[field]);
                      const label = field === 'can_write' ? '쓰기' : field === 'can_edit' ? '편집' : '삭제';

                      return (
                        <td key={field} className="px-4 py-3 text-center">
                          {isEditing && !isProtectedAdmin ? (
                            <button
                              type="button"
                              onClick={() => togglePermission(editData, setEditData, field)}
                              className={`px-2.5 py-1 rounded text-xs font-medium border ${
                                enabled
                                  ? 'bg-green-600 text-white border-green-600'
                                  : 'bg-white text-gray-600 border-gray-300'
                              }`}
                            >
                              {label}
                            </button>
                          ) : (
                            <span className={`badge ${enabled ? 'badge-normal' : 'badge-gray'}`}>
                              {enabled ? '허용' : '없음'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-center">
                        {isEditing ? (
                          <>
                            <button onClick={handleSave} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="저장">
                              <Save size={15} />
                            </button>
                            <button onClick={handleCancel} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg" title="취소">
                              <X size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            {isAdmin && (
                              <button onClick={() => handleEdit(user)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="수정">
                                <Edit2 size={15} />
                              </button>
                            )}
                            {canDeleteThisUser && (
                              <button onClick={() => handleDeleteUser(user)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="삭제">
                                <Trash2 size={15} />
                              </button>
                            )}
                            {isProtectedAdmin && (
                              <span className="p-1.5 text-blue-600" title="관리자 전체 권한">
                                <ShieldCheck size={15} />
                              </span>
                            )}
                            {!isAdmin && !canDeleteThisUser && !isProtectedAdmin && (
                              <span className="text-gray-300 text-xs">-</span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedUsers.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-400">
                    등록된 담당자가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
