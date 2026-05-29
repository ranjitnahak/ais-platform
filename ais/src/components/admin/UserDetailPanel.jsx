import { useMemo, useState } from 'react';
import ImageCropModal from '../athletes/ImageCropModal';
import UserPermissionsTab from './UserPermissionsTab';
import UserProfileTab from './UserProfileTab';
import UserDangerZone from './UserDangerZone';
import TabShell from '../layout/TabShell';
import { useUserProfilePanel } from '../../hooks/useUserProfilePanel';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useUser } from '../../context/UserContext';
import { formatRoleOrPosition } from '../../lib/adminUserConstants';

const USER_PANEL_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'permissions', label: 'Permissions' },
];

function UserPanelTabBar({ tabs, activeTab, onTabChange, onTabHover }) {
  return (
    <div className="flex gap-1 border-b border-[var(--color-outline-variant)] p-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          onPointerEnter={onTabHover ? () => onTabHover(tab.id) : undefined}
          onFocus={onTabHover ? () => onTabHover(tab.id) : undefined}
          className={`flex-1 rounded-lg py-2 text-xs font-black uppercase tracking-widest ${
            activeTab === tab.id
              ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
              : 'text-[var(--color-on-surface-variant)]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function UserDetailPanel({ target, onClose, onUpdated }) {
  const { activeOrgId, user, refreshUser } = useUser();
  const [activeTab, setActiveTab] = useState('profile');
  const profile = useUserProfilePanel({ target, activeOrgId, onUpdated });
  const permissions = useUserPermissions(profile.userId, target?.orgId ?? activeOrgId, {
    onSaved: ({ targetUserId, isSelfEdit }) => {
      if (isSelfEdit && targetUserId === user?.id) void refreshUser();
    },
  });
  const canShowPermissions = Boolean(profile.userId);

  function handlePickPhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = (event) => {
      const file = event.target.files?.[0];
      if (file) profile.handlePhotoChange(file);
    };
    input.click();
  }

  const displayName = profile.isStaff
    ? [profile.staffForm.first_name, profile.staffForm.last_name].filter(Boolean).join(' ') || target?.fullName
    : [profile.athleteForm.first_name, profile.athleteForm.last_name].filter(Boolean).join(' ') || target?.fullName;

  const subtitle = profile.isStaff
    ? formatRoleOrPosition(profile.staffForm.roleLabel)
    : formatRoleOrPosition(profile.athleteForm.position || 'Athlete');

  const panels = useMemo(
    () => ({
      profile: () => <UserProfileTab profile={profile} onPickPhoto={handlePickPhoto} />,
      permissions: () => (
        canShowPermissions ? (
          <UserPermissionsTab permissions={permissions} />
        ) : (
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Permissions are available after the user has an account. Send an invite first.
          </p>
        )
      ),
    }),
    [profile, permissions, canShowPermissions],
  );

  return (
    <>
      {profile.pendingFile && (
        <ImageCropModal
          file={profile.pendingFile}
          onCancel={profile.handleCropCancel}
          onCrop={profile.handleCropDone}
        />
      )}

      <div
        className="fixed inset-0 z-[100] bg-[var(--color-surface-container-lowest)]/60"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className="fixed inset-y-0 right-0 z-[105] flex w-full max-w-lg flex-col border-l border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="User details"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-outline-variant)] p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary-container)]">
              {profile.isStaff ? 'Staff' : 'Athlete'}
            </p>
            <h2 className="truncate text-xl font-black text-[var(--color-on-surface)]">
              {displayName || 'User'}
            </h2>
            <p className="text-sm text-[var(--color-on-surface-variant)]">{subtitle}</p>
            {!profile.isActive && (
              <span className="mt-2 inline-block rounded-full bg-[var(--color-surface-variant)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                Inactive
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[var(--color-outline)] hover:bg-[var(--color-surface-variant)] hover:text-[var(--color-on-surface)]"
            aria-label="Close panel"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {profile.loading && (
            <p className="p-5 text-sm text-[var(--color-outline)]">Loading profile…</p>
          )}
          {!profile.loading && profile.error && (
            <p className="p-5 text-sm text-[var(--color-error)]">{profile.error}</p>
          )}
          {!profile.loading && !profile.error && (
            <>
              <TabShell
                tabs={USER_PANEL_TABS}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                panels={panels}
                scopeKey={profile.userId ?? target?.id ?? 'user-panel'}
                className="flex min-h-0 flex-1 flex-col space-y-0"
                panelClassName="relative flex-1 p-5"
                renderTabBar={(tabBarProps) => <UserPanelTabBar {...tabBarProps} />}
              />
              <div className="border-t border-[var(--color-outline-variant)] p-5">
                <UserDangerZone profile={profile} onRoleChanged={permissions.reload} />
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
