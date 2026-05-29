import { isVisibleSync } from '../lib/auth';

/** Maps staff nav routes to permission resources (visibility + CRUD). */
export const NAV_ROUTE_RESOURCE = {
  '/dashboard': null,
  '/athletes': 'athleteRoster',
  '/periodisation': 'periodisation',
  '/log': null,
  '/reports': 'reports',
  '/admin': 'adminConfig',
  '/settings': null,
  '/superuser': null,
};

/** Reports nav/page also covers unified AI reports. */
export function isReportsNavVisible(user) {
  if (!user || user.isSuperuser) return true;
  return isVisibleSync(user, 'reports') || isVisibleSync(user, 'unified_reports');
}

/** Whether a staff nav route should appear (visibility flag, not CRUD). */
export function isNavRouteVisible(user, to) {
  if (!user) return false;
  if (user.isSuperuser) return true;
  if (to === '/reports') return isReportsNavVisible(user);
  const resource = NAV_ROUTE_RESOURCE[to];
  if (!resource) return true;
  return isVisibleSync(user, resource);
}

export function filterStaffNavItems(items, user) {
  return items.filter((item) => isNavRouteVisible(user, item.to));
}
