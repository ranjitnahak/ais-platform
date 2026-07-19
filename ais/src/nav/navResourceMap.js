import { isVisibleSync } from '../lib/auth';
import { DASHBOARD_SUB_ITEMS } from './dashboardNavItems';
import { DEFAULT_LOG_ROUTE, LOG_SUB_ITEMS } from './logNavItems';

/** Maps staff nav routes to permission resources (visibility + CRUD). */
export const NAV_ROUTE_RESOURCE = {
  '/dashboard': null,
  '/dashboard/wellness': 'wellness',
  '/dashboard/attendance': 'attendance',
  '/dashboard/rpe': 'rpe_logging',
  '/dashboard/assessment': 'assessments',
  '/athletes': 'athleteRoster',
  '/plan': 'periodisation',
  '/periodisation': 'periodisation',
  '/plan/calendar': 'periodisation',
  '/log': null,
  '/log/rpe': 'rpe_logging',
  '/log/wellness': 'wellness',
  '/log/assessment': 'assessments',
  '/log/staff-notes': 'staff_notes',
  '/log/attendance': 'attendance',
  '/log/dexa': null,
  '/reports': 'reports',
  '/admin': 'adminConfig',
  '/settings': null,
  '/superuser': null,
};

const DASHBOARD_NAV_RESOURCES = ['wellness', 'attendance', 'rpe_logging', 'injury_surveillance', 'assessments'];
const LOG_NAV_RESOURCES = ['wellness', 'rpe_logging', 'assessments', 'staff_notes', 'attendance'];

const STAFF_HOME_ROUTE_ORDER = [
  '/dashboard',
  '/athletes',
  '/log',
  '/reports',
  '/periodisation',
  '/admin',
  '/settings',
];

/** Dashboard nav when any dashboard sub-resource is visible. */
export function isDashboardNavVisible(user) {
  if (!user || user.isSuperuser) return true;
  return DASHBOARD_NAV_RESOURCES.some((resource) => isVisibleSync(user, resource));
}

/** Whether a dashboard sub-route should appear in sidebar / mobile nav. */
export function isDashboardSubRouteVisible(user, to) {
  if (!user) return false;
  if (user.isSuperuser) return true;
  const item = DASHBOARD_SUB_ITEMS.find((sub) => sub.to === to);
  if (!item?.resource) return true;
  return isVisibleSync(user, item.resource);
}

export function filterDashboardSubItems(user) {
  return DASHBOARD_SUB_ITEMS.filter((item) => isDashboardSubRouteVisible(user, item.to));
}

/** First dashboard sub-route the user can access. */
export function getDefaultDashboardRoute(user) {
  const visible = filterDashboardSubItems(user);
  return visible[0]?.to ?? '/dashboard/wellness';
}

/** Log nav when any log tab resource is visible. */
export function isLogNavVisible(user) {
  if (!user || user.isSuperuser) return true;
  return LOG_NAV_RESOURCES.some((resource) => isVisibleSync(user, resource));
}

/** Whether a log sub-route should appear in sidebar / mobile nav. */
export function isLogSubRouteVisible(user, to) {
  if (!user) return false;
  if (user.isSuperuser) return true;
  const item = LOG_SUB_ITEMS.find((sub) => sub.to === to);
  if (!item?.resource) return true;
  return isVisibleSync(user, item.resource);
}

export function filterLogSubItems(user) {
  return LOG_SUB_ITEMS.filter((item) => isLogSubRouteVisible(user, item.to));
}

/** First log sub-route the user can access. */
export function getDefaultLogRoute(user) {
  const visible = filterLogSubItems(user);
  return visible[0]?.to ?? DEFAULT_LOG_ROUTE;
}

/** Reports nav/page also covers unified AI reports. */
export function isReportsNavVisible(user) {
  if (!user || user.isSuperuser) return true;
  return isVisibleSync(user, 'reports') || isVisibleSync(user, 'unified_reports');
}

/** First staff route the user can see (for home redirect). */
export function getDefaultStaffHomeRoute(user) {
  if (!user) return '/dashboard';
  const route = STAFF_HOME_ROUTE_ORDER.find((to) => isNavRouteVisible(user, to));
  return route ?? '/settings';
}

/** Whether a staff nav route should appear (visibility flag, not CRUD). */
export function isNavRouteVisible(user, to) {
  if (!user) return false;
  if (user.isSuperuser) return true;
  if (to === '/dashboard') return isDashboardNavVisible(user);
  if (to === '/log') return isLogNavVisible(user);
  if (to === '/reports') return isReportsNavVisible(user);
  const resource = NAV_ROUTE_RESOURCE[to];
  if (!resource) return true;
  return isVisibleSync(user, resource);
}

export function filterStaffNavItems(items, user) {
  return items.filter((item) => isNavRouteVisible(user, item.to));
}
