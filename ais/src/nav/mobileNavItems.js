/** Mobile bottom bar + More sheet items (staff). */
export const STAFF_BOTTOM_NAV = [
  { icon: 'space_dashboard', label: 'Dashboard', to: '/dashboard', sheetId: 'dashboard' },
  { icon: 'view_week', label: 'Plan', to: '/plan', sheetId: 'plan' },
  { icon: 'edit_note', label: 'Log', to: '/log', sheetId: 'log' },
  { icon: 'group', label: 'Athletes', to: '/athletes' },
];

export const STAFF_DASHBOARD_NAV = [
  { icon: 'monitor_heart', label: 'Wellness', to: '/dashboard/wellness', resource: 'wellness' },
  { icon: 'event_available', label: 'Attendance', to: '/dashboard/attendance', resource: 'attendance' },
  { icon: 'fitness_center', label: 'RPE', to: '/dashboard/rpe', resource: 'rpe_logging' },
  { icon: 'trending_up', label: 'Assessment', to: '/dashboard/assessment', resource: 'assessments' },
];

export const STAFF_LOG_NAV = [
  { icon: 'fitness_center', label: 'RPE Entry', to: '/log/rpe', resource: 'rpe_logging' },
  { icon: 'monitor_heart', label: 'Wellness Entry', to: '/log/wellness', resource: 'wellness' },
  { icon: 'trending_up', label: 'Assessment', to: '/log/assessment', resource: 'assessments' },
  { icon: 'sticky_note_2', label: 'Staff Notes', to: '/log/staff-notes', resource: 'staff_notes' },
  { icon: 'event_available', label: 'Attendance', to: '/log/attendance', resource: 'attendance' },
  { icon: 'upload_file', label: 'DEXA Upload', to: '/log/dexa' },
];

export const STAFF_PLAN_NAV = [
  { icon: 'view_week', label: 'Periodisation', to: '/periodisation' },
  { icon: 'calendar_month', label: 'Calendar', to: '/plan/calendar' },
];

export const STAFF_MORE_NAV = [
  { icon: 'description', label: 'Reports', to: '/reports' },
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
