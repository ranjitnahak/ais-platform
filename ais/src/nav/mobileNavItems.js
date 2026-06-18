/** Mobile bottom bar + More sheet items (staff). */
export const STAFF_BOTTOM_NAV = [
  { icon: 'space_dashboard', label: 'Dashboard', to: '/dashboard/wellness' },
  { icon: 'edit_note', label: 'Log', to: '/log' },
  { icon: 'group', label: 'Athletes', to: '/athletes' },
  { icon: 'description', label: 'Reports', to: '/reports' },
];

export const STAFF_DASHBOARD_NAV = [
  { icon: 'monitor_heart', label: 'Wellness', to: '/dashboard/wellness', resource: 'wellness' },
  { icon: 'fitness_center', label: 'RPE', to: '/dashboard/rpe', resource: 'rpe_logging' },
  { icon: 'trending_up', label: 'Assessment', to: '/dashboard/assessment', resource: 'assessments' },
];

export const STAFF_PLAN_NAV = [
  { icon: 'view_week', label: 'Periodisation', to: '/periodisation' },
  { icon: 'calendar_month', label: 'Calendar', to: '/plan/calendar' },
];

export const STAFF_MORE_NAV = [
  { icon: 'admin_panel_settings', label: 'Admin', to: '/admin', adminOnly: true },
  { icon: 'settings', label: 'Settings', to: '/settings' },
  { icon: 'shield', label: 'Superuser', to: '/superuser', superuserOnly: true },
];

/** Mobile bottom bar + More sheet items (athlete). */
export const ATHLETE_BOTTOM_NAV = [
  { icon: 'home', label: 'Home', to: '/athlete-home' },
  { icon: 'edit_note', label: 'Log', to: '/athlete-log' },
  { icon: 'bar_chart', label: 'My Data', to: '/athlete-data' },
];

export const ATHLETE_MORE_NAV = [
  { icon: 'settings', label: 'Settings', to: '/athlete-settings' },
  { icon: 'person', label: 'Profile', to: '/athlete-profile' },
];
