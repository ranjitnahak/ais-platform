/** Shared desktop sidebar navigation (staff). */
export const MAIN_NAV_ITEMS = [
  { icon: 'dashboard', label: 'Dashboard', to: '/dashboard' },
  { icon: 'person', label: 'Athletes', to: '/athletes' },
  { icon: 'calendar_month', label: 'Periodisation', to: '/periodisation' },
  { icon: 'edit_note', label: 'Log', to: '/log' },
  { icon: 'assessment', label: 'Reports', to: '/reports' },
  { icon: 'admin_panel_settings', label: 'Admin', to: '/admin', adminOnly: true },
  { icon: 'settings', label: 'Settings', to: '/settings' },
];

export const SUPERUSER_NAV_ITEM = { icon: 'shield', label: 'Superuser', to: '/superuser' };
