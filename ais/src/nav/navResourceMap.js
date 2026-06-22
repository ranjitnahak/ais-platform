import { isVisibleSync } from '../lib/auth';
import { DASHBOARD_SUB_ITEMS } from './dashboardNavItems';

/** Maps staff nav routes to permission resources (visibility + CRUD). */
export const NAV_ROUTE_RESOURCE = {
  '/dashboard': null,
  '/dashboard/wellness': 'wellness',
  '/dashboard/rpe': 'rpe_logging',
  '/dashboard/assessment': 'assessments',
  '/athletes': 'athleteRoster',
  '/periodisation': 'periodisation',
  '/plan/calendar': 'periodisation',
  '/log': null,
  '/reports': 'reports',
  '/admin': 'adminConfig',
  '/settings': null,
  '/superuser': null,
};

const DASHBOARD_NAV_RESOURCES = ['wellness', 'rpe_logging', 'injury_surveillance', 'assessments'];
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
