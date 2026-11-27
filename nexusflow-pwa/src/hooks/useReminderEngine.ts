import { useCallback, useEffect, useRef, useState } from 'react';
import { Project, ShoulderTapTone, TaskItem } from '../types';
import { REMINDER_POLL_INTERVAL_MS } from '../config/runtimeConfig';
import {
  isReminderDueForWindow,
  triggerDesktopReminderNotification
} from '../services/cloudSyncAndPush';
import {
  computeShoulderTapStage,
  getShoulderTapCopy,
  isWithinQuietHours
} from '../services/adhsDriveEngine';

export interface DueReminderItem {
  projectId: string;
  projectName: string;
  projectColor: string;
  task: TaskItem;
  firedKey: string;
  shoulderTapStage?: 1 | 2 | 3 | 4;
  shoulderTapLabel?: string;
  shoulderTapMessage?: string;
}

interface UseReminderEngineOptions {
  projects: Project[];
  enabled: boolean;
  systemPushEnabled?: boolean;
  shoulderTapEnabled?: boolean;
  shoulderTapQuietStart?: string;
  shoulderTapQuietEnd?: string;
  shoulderTapTone?: ShoulderTapTone;
  hydrated: boolean;
  onMarkReminderFired: (
    projectId: string,
    taskId: string,
    firedIso: string,
    shoulderTapStage?: number
  ) => void;
}

export function useReminderEngine({
  projects,
  enabled,
  systemPushEnabled = true,
  shoulderTapEnabled = false,
  shoulderTapQuietStart = '22:00',
  shoulderTapQuietEnd = '08:00',
  shoulderTapTone = 'calm',
  hydrated,
  onMarkReminderFired
}: UseReminderEngineOptions) {
  const [queue, setQueue] = useState<DueReminderItem[]>([]);
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  const onMarkFiredRef = useRef(onMarkReminderFired);
  onMarkFiredRef.current = onMarkReminderFired;

  const systemPushEnabledRef = useRef(systemPushEnabled);
  systemPushEnabledRef.current = systemPushEnabled;

  const shoulderTapEnabledRef = useRef(shoulderTapEnabled);
  shoulderTapEnabledRef.current = shoulderTapEnabled;

  const quietStartRef = useRef(shoulderTapQuietStart);
  quietStartRef.current = shoulderTapQuietStart;

  const quietEndRef = useRef(shoulderTapQuietEnd);
  quietEndRef.current = shoulderTapQuietEnd;

  const toneRef = useRef(shoulderTapTone);
  toneRef.current = shoulderTapTone;

  const notifiedKeysRef = useRef<Set<string>>(new Set());

  const scanNow = useCallback(() => {
    if (!hydrated || !enabled) return;

    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const newItems: DueReminderItem[] = [];

    if (shoulderTapEnabledRef.current) {
      // Absoluter Ruhezeiten-Schutz: weder System-Notifications noch eskalierende Schultertipps
      if (isWithinQuietHours(now, quietStartRef.current, quietEndRef.current)) {
        return;
      }

      for (const proj of projectsRef.current) {
        if (proj.archived) continue;
        for (const task of proj.tasks) {
          if (task.completed || !task.reminderAt || !task.reminderAt.trim()) continue;
          const raw = task.reminderAt.trim();
          const isTimeOnly = /^\d{1,2}:\d{2}$/.test(raw);
          if (isTimeOnly) {
            const firedToday = Boolean(
              task.lastReminderFiredAt && task.lastReminderFiredAt.slice(0, 10) === dateKey
            );
            if (!firedToday && !isReminderDueForWindow(task, now)) continue;
          }

          const stage = computeShoulderTapStage(raw, now);
          if (stage === 0) continue;
          const prevStage = task.lastShoulderTapStage ?? 0;
          if (stage <= prevStage) continue;

          const firedKey = `${proj.id}_${task.id}_${raw}_stage_${stage}_${
            isTimeOnly ? dateKey : 'iso'
          }`;
          if (notifiedKeysRef.current.has(firedKey)) continue;

          notifiedKeysRef.current.add(firedKey);
          const copy = getShoulderTapCopy(stage, toneRef.current, task.title);
          const firedIso = now.toISOString();
          onMarkFiredRef.current(proj.id, task.id, firedIso, stage);
          if (systemPushEnabledRef.current) {
            void triggerDesktopReminderNotification(
              proj.name,
              `${copy.stageLabel}: ${copy.message}`
            );
          }

          newItems.push({
            projectId: proj.id,
            projectName: proj.name,
            projectColor: proj.accentColor || '#E5A93C',
            task: { ...task, lastReminderFiredAt: firedIso, lastShoulderTapStage: stage },
            firedKey,
            shoulderTapStage: stage,
            shoulderTapLabel: copy.stageLabel,
            shoulderTapMessage: copy.message
          });
        }
      }
    } else {
      for (const proj of projectsRef.current) {
        if (proj.archived) continue;
        for (const task of proj.tasks) {
          if (!isReminderDueForWindow(task, now)) continue;
          const firedKey = `${proj.id}_${task.id}_${task.reminderAt.trim()}_${/^\d{1,2}:\d{2}$/.test(task.reminderAt.trim()) ? dateKey : 'iso'
            }`;
          if (notifiedKeysRef.current.has(firedKey)) continue;

          notifiedKeysRef.current.add(firedKey);
          const firedIso = now.toISOString();
          onMarkFiredRef.current(proj.id, task.id, firedIso);
          if (systemPushEnabledRef.current) {
            void triggerDesktopReminderNotification(proj.name, task.title);
          }

          newItems.push({
            projectId: proj.id,
            projectName: proj.name,
            projectColor: proj.accentColor || '#E5A93C',
            task: { ...task, lastReminderFiredAt: firedIso },
            firedKey
          });
        }
      }
    }

    if (newItems.length > 0) {
      setQueue((prev) => {
        const existingKeys = new Set(prev.map((q) => q.firedKey));
        const uniqueNew = newItems.filter((it) => !existingKeys.has(it.firedKey));
        if (uniqueNew.length === 0) return prev;
        const replacedTaskKeys = new Set(uniqueNew.map((it) => `${it.projectId}:${it.task.id}`));
        const filteredPrev = prev.filter(
          (it) => !replacedTaskKeys.has(`${it.projectId}:${it.task.id}`)
        );
        return [...filteredPrev, ...uniqueNew];
      });
    }
  }, [hydrated, enabled]);

  useEffect(() => {
    if (!hydrated || !enabled) {
      setQueue([]);
      return;
    }

    scanNow();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scanNow();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    const intervalId = window.setInterval(scanNow, REMINDER_POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [hydrated, enabled, scanNow]);

  // Sofortiges Nachprüfen nach Projekt-, Task- oder Schultertipp-Änderungen
  useEffect(() => {
    if (!hydrated || !enabled) return;
    scanNow();
  }, [
    projects,
    hydrated,
    enabled,
    shoulderTapEnabled,
    shoulderTapQuietStart,
    shoulderTapQuietEnd,
    shoulderTapTone,
    scanNow
  ]);

  const dismissActiveReminder = useCallback((firedKey?: string) => {
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      if (!firedKey) return prev.slice(1);
      return prev.filter((item) => item.firedKey !== firedKey);
    });
  }, []);

  return {
    activeReminder: queue[0] || null,
    pendingCount: queue.length,
    dismissActiveReminder
  };
}
