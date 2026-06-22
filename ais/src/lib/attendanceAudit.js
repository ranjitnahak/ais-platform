import { supabase } from './supabase';

export async function logAttendanceChange({ userId, recordId, oldData, newData }) {
  try {
    const { error } = await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'attendance_mark',
      table_name: 'attendance_records',
      record_id: recordId,
      old_data: oldData,
      new_data: newData,
    });
    if (error) throw error;
  } catch (err) {
    console.error('[logAttendanceChange] failed:', err);
  }
}
