import { supabase } from './supabase';
import { formatRoleOrPosition } from './adminUserConstants';

export async function signOutAndRedirect() {
  await supabase.auth.signOut();
  window.location.href = '/login';
}

export function getUserAccountLabels(user) {
  const displayName = user?.fullName?.trim() || 'Signed in user';
  const formattedRole = formatRoleOrPosition(user?.role);
  const roleLabel = formattedRole === '—' ? 'User' : formattedRole;
  return { displayName, roleLabel };
}
