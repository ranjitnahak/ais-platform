/** Mobile bottom bar + More sheet items (staff). */
export const STAFF_BOTTOM_NAV = [
  { icon: 'space_dashboard', label: 'Dashboard', to: '/dashboard' },
  { icon: 'edit_note', label: 'Log', to: '/log' },
  { icon: 'group', label: 'Athletes', to: '/athletes' },
  { icon: 'description', label: 'Reports', to: '/reports' },
];

export const STAFF_MORE_NAV = [
  { icon: 'calendar_month', label: 'Periodisation', to: '/periodisation' },
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
