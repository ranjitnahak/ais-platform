import { useState } from 'react';
import StaffPageLayout from '../components/layout/StaffPageLayout';
import PageTabBar from '../components/layout/PageTabBar';
import RPEEntryForm from '../components/log/RPEEntryForm';
import WellnessEntryForm from '../components/log/WellnessEntryForm';
import StaffNotes from './StaffNotes';

const TABS = [
  { id: 'rpe', label: 'RPE Entry' },
  { id: 'wellness', label: 'Wellness Entry' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'staff-notes', label: 'Staff Notes' },
];

function AssessmentTab() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center">
      <span className="material-symbols-outlined text-5xl text-[var(--color-outline)]">construction</span>
      <h2 className="mt-4 text-2xl font-black tracking-tight text-[var(--color-on-surface)]">Assessment</h2>
      <p className="mt-2 text-sm font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">Coming soon</p>
    </div>
  );
}

export default function Log() {
  const [activeTab, setActiveTab] = useState('rpe');

  return (
    <StaffPageLayout title="Log" subtitle="Record training and wellness data" showSearch={false}>
      <PageTabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === 'rpe' && <RPEEntryForm />}
      {activeTab === 'wellness' && <WellnessEntryForm />}
      {activeTab === 'assessment' && <AssessmentTab />}
      {activeTab === 'staff-notes' && <StaffNotes embedded />}
    </StaffPageLayout>
  );
}
