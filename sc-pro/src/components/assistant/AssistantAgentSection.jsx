import AgentProgressCard from './AgentProgressCard.jsx'
import AgentChoiceCard from './AgentChoiceCard.jsx'
import AgentReportCard from './AgentReportCard.jsx'
import AssistantPlanSummary from './AssistantPlanSummary.jsx'
import { getProgrammeAgentHost } from '../../lib/agentProgrammeHost.js'

function TypingExtract() {
  return (
    <div className="sc-body-sm" style={{ color: 'var(--color-text-muted)', padding: '8px 0' }}>
      <span style={{ color: 'var(--color-primary)' }}>…</span> Reading your programme…
    </div>
  )
}

export default function AssistantAgentSection({ agent, planningWeek, setPlanningWeek, coachDraft, setCoachDraft }) {
  const {
    agentState,
    extractedPlan,
    currentWeek,
    error: agentError,
    currentStep,
    totalSteps,
    stepDescription,
    completedSteps,
    activeDecision,
    buildReport,
    confirmPlan,
    resolveDecision,
    stopBuild,
    resetAgent,
  } = agent

  const host = getProgrammeAgentHost()
  const totalWeeks = Math.min(
    extractedPlan?.total_weeks ?? 1,
    extractedPlan?.weeks?.length ?? 1,
    host?.weeks?.length ?? 1,
  )

  if (agentState === 'idle' && !agentError) return null

  return (
    <div style={{ marginBottom: 10 }}>
      {agentError && agentState === 'idle' ? (
        <p className="sc-body-sm" style={{ color: 'var(--color-danger)' }}>
          {agentError}
        </p>
      ) : null}

      {agentState === 'extracting' ? <TypingExtract /> : null}

      {agentState === 'planning' && extractedPlan ? (
        <div>
          <AssistantPlanSummary
            plan={extractedPlan}
            startWeek={planningWeek}
            onBuildWeek1={() => void confirmPlan(planningWeek, coachDraft)}
            onReview={() => setCoachDraft((d) => d)}
            onCancel={() => resetAgent()}
          />
          <label className="sc-label-caps" style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: 8 }}>
            Notes for this week (optional)
          </label>
          <textarea
            value={coachDraft}
            onChange={(e) => setCoachDraft(e.target.value)}
            rows={2}
            placeholder="e.g. increase main lift intensity by 5%"
            style={{
              width: '100%',
              marginTop: 4,
              padding: 8,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 12,
            }}
          />
        </div>
      ) : null}

      {agentState === 'executing' ? (
        <AgentProgressCard
          currentWeek={currentWeek}
          totalWeeks={totalWeeks}
          currentStep={currentStep}
          totalSteps={totalSteps}
          stepDescription={stepDescription}
          completedSteps={completedSteps}
          onStop={stopBuild}
        />
      ) : null}

      {agentState === 'paused' && activeDecision ? (
        <AgentChoiceCard
          decision={activeDecision}
          onChoice={(c) => resolveDecision(c)}
          onSkip={() => resolveDecision('Skip and continue')}
        />
      ) : null}

      {agentState === 'complete' ? (
        <AgentReportCard
          report={buildReport}
          totalWeeks={totalWeeks}
          onViewProgramme={() => {
            const id = getProgrammeAgentHost()?.programmeId
            if (id) window.location.href = `/programmes/${id}`
          }}
          onStartOver={() => {
            resetAgent()
            setPlanningWeek(1)
            setCoachDraft('')
          }}
        />
      ) : null}
    </div>
  )
}
