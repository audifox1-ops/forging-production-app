import type { User } from '../types';

export function resolveCurrentUser(users: User[], currentUserId: string) {
  return users.find(user => user.id === currentUserId)
    ?? users.find(user => user.role === 'admin')
    ?? users[0];
}

export function canCreateReport(user?: User) {
  return user?.role === 'admin'
    || user?.role === 'manager'
    || Boolean(user?.can_write)
    || Boolean(user?.can_edit);
}
