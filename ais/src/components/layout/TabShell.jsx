import { useCallback, useEffect, useMemo, useState } from 'react';
import PageTabBar from './PageTabBar';
import { scheduleIdleWork } from '../../lib/scheduleIdleWork';

const ACTIVE_TAB_SETTLE_MS = 150;

/**
 * Generic tab shell: keeps visited/prefetched panels mounted (hidden) so tab
 * switches feel instant. Prefetches other visible tabs on idle and hover.
 *
 * @param {object} props
 * @param {Array<{ id: string, label: string, prefetch?: boolean }>} props.tabs
 * @param {string} props.activeTab
 * @param {(tabId: string) => void} props.onTabChange
 * @param {Record<string, () => import('react').ReactNode>} props.panels
 * @param {string} [props.scopeKey] - when changed, remounts panels (e.g. org id)
 * @param {string} [props.className]
 * @param {string} [props.panelClassName]
 * @param {(props: { tabs: typeof tabs, activeTab: string, onTabChange: typeof onTabChange, onTabHover: (tabId: string) => void }) => import('react').ReactNode} [props.renderTabBar]
 */
export default function TabShell({
  tabs,
  activeTab,
  onTabChange,
  panels,
  scopeKey = 'default',
  className = '',
  panelClassName = 'relative',
  renderTabBar,
}) {
  const [prefetchedTabs, setPrefetchedTabs] = useState(() => new Set());
  const [trackedScopeKey, setTrackedScopeKey] = useState(scopeKey);

  if (trackedScopeKey !== scopeKey) {
    setTrackedScopeKey(scopeKey);
    setPrefetchedTabs(new Set());
  }

  const mountTab = useCallback((tabId) => {
    if (!tabId || !panels[tabId]) return;
    setPrefetchedTabs((prev) => {
      if (prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });
  }, [panels]);

  const visibleIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);

  const mountedTabs = useMemo(() => {
    const next = new Set([...prefetchedTabs].filter((id) => visibleIds.has(id)));
    if (visibleIds.has(activeTab)) next.add(activeTab);
    return next;
  }, [prefetchedTabs, visibleIds, activeTab]);

  useEffect(() => {
    const candidates = tabs
      .filter((tab) => tab.id !== activeTab && tab.prefetch !== false && panels[tab.id])
      .map((tab) => tab.id)
      .filter((tabId) => !mountedTabs.has(tabId));

    if (!candidates.length) return undefined;

    let cancelled = false;
    const cancelIdleFns = [];
    let index = 0;

    function prefetchNext() {
      if (cancelled || index >= candidates.length) return;

      const tabId = candidates[index];
      index += 1;

      const cancelIdle = scheduleIdleWork(() => {
        if (cancelled) return;
        mountTab(tabId);
        prefetchNext();
      });
      cancelIdleFns.push(cancelIdle);
    }

    const settleTimer = window.setTimeout(prefetchNext, ACTIVE_TAB_SETTLE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(settleTimer);
      cancelIdleFns.forEach((cancel) => cancel());
    };
  }, [tabs, activeTab, mountedTabs, mountTab, panels]);

  const handleTabHover = useCallback(
    (tabId) => {
      mountTab(tabId);
    },
    [mountTab],
  );

  const tabBarProps = {
    tabs,
    activeTab,
    onTabChange,
    onTabHover: handleTabHover,
  };

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      {renderTabBar ? renderTabBar(tabBarProps) : <PageTabBar {...tabBarProps} />}
      <div className={panelClassName}>
        {tabs.map((tab) => {
          if (!mountedTabs.has(tab.id) || !panels[tab.id]) return null;
          const isActive = activeTab === tab.id;

          return (
            <div
              key={`${scopeKey}-${tab.id}`}
              hidden={!isActive}
              aria-hidden={!isActive}
            >
              {panels[tab.id]()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
