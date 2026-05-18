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

const SUPERVISOR_SALUD_TABS = new Set([
  'inicio',
  'salud',
  'salud-atenciones',
  'salud-tipos',
  'salud-establecimientos',
  'salud-dashboard',
  'salud-personal',
]);

export const canAccessTab = (user: User | undefined, tab: string): boolean => {
  if (isSupervisorSaludOnly(user)) return SUPERVISOR_SALUD_TABS.has(tab);
  return true;
};

export const defaultTabFor = (user?: User): string =>
  isSupervisorSaludOnly(user) ? 'salud-atenciones' : 'inicio';
