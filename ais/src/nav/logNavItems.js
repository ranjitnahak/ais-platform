/** Log sidebar / mobile sub-navigation (staff). */
export const LOG_SUB_ITEMS = [
  { label: 'RPE Entry', to: '/log/rpe', icon: 'ti-activity', resource: 'rpe_logging' },
  { label: 'Wellness Entry', to: '/log/wellness', icon: 'ti-heart-rate-monitor', resource: 'wellness' },
  { label: 'Assessment', to: '/log/assessment', icon: 'ti-chart-line', resource: 'assessments' },
  { label: 'Staff Notes', to: '/log/staff-notes', icon: 'ti-notes', resource: 'staff_notes' },
  { label: 'Attendance', to: '/log/attendance', icon: 'ti-calendar-check', resource: 'attendance' },
  { label: 'DEXA Upload', to: '/log/dexa', icon: 'ti-upload' },
];

export const DEFAULT_LOG_ROUTE = '/log/rpe';
