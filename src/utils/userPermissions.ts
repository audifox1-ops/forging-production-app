import type { User } from '../types';

export function resolveHydratedUsers(remoteUsers: User[], currentUsers: User[], fallbackUsers: User[]) {
  return remoteUsers.length > 0
    ? remoteUsers
    : currentUsers.length > 0
      ? currentUsers
      : fallbackUsers;
}

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
