import { useUser } from '../context/UserContext';
import PersonalisedHeader from '../components/shared/PersonalisedHeader';
import LogSkeleton from '../components/shared/skeletons/LogSkeleton';
import { useAthleteHome } from '../hooks/useAthleteHome';
import {
  AthleteStatsRow,
  DailyCheckInCard,
  QuickActionsCard,
  TodaySessionCard,
} from '../components/athlete-home/AthleteHomeCards';

export default function AthleteHome() {
  const { user } = useUser();
  const {
    loading,
    error,
    wellnessDoneToday,
    todaySessions,
    streakDays,
    streakCount,
    lastRpe,
    lastRpeDateLabel,
    refreshTodaySessions,
  } = useAthleteHome();

  return (
    <div className="mx-auto max-w-[480px] space-y-4">
      <PersonalisedHeader user={user} />

      {loading && <LogSkeleton />}

      {error && (
        <p className="rounded-2xl border border-[var(--color-error-container)] bg-[var(--color-surface-container)] p-4 text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

      {!loading && (
        <>
          <DailyCheckInCard doneToday={wellnessDoneToday} />
          <TodaySessionCard sessions={todaySessions} onRpeLogged={() => void refreshTodaySessions()} />
          <AthleteStatsRow
            streakDays={streakDays}
            streakCount={streakCount}
            lastRpe={lastRpe}
            lastRpeDateLabel={lastRpeDateLabel}
          />
          <QuickActionsCard />
        </>
      )}
    </div>
  );
}
