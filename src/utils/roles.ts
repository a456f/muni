import type { User } from '../services/authService';

export const HEALTH_ROLES = ['medico', 'enfermero', 'paramedico', 'personal_salud', 'supervisor_salud'];
export const HEALTH_STAFF_ROLES = ['medico', 'enfermero', 'paramedico', 'personal_salud'];
const ADMIN_ROLES = ['superadmin', 'admin'];

export const getUserRoles = (user?: User): string[] => {
  if (!user) return [];
  if (user.roles && user.roles.length > 0) return user.roles;
  return user.role ? [user.role] : [];
};

export const isAdmin = (user?: User): boolean =>
  getUserRoles(user).some((r) => ADMIN_ROLES.includes(r));

export const isSupervisorSaludOnly = (user?: User): boolean => {
  const roles = getUserRoles(user);
  return roles.includes('supervisor_salud') && !roles.some((r) => ADMIN_ROLES.includes(r));
};
