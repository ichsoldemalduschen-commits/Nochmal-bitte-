import { useCallback, useEffect, useRef, useState } from 'react';
import { Project, TaskItem } from '../types';
import { REMINDER_POLL_INTERVAL_MS } from '../config/runtimeConfig';
import {
  isReminderDueForWindow,
  triggerDesktopReminderNotification
} from '../services/cloudSyncAndPush';

export interface DueReminderItem {
  projectId: string;
  projectName: string;
  projectColor: string;
  task: TaskItem;
  firedKey: string;
}

interface UseReminderEngineOptions {
  projects: Project[];
  enabled: boolean;
  hydrated: boolean;
  onMarkReminderFired: (projectId: string, taskId: string, firedIso: string) => void;
}

export function useReminderEngine({
  projects,
  enabled,
  hydrated,
  onMarkReminderFired
}: UseReminderEngineOptions) {
  const [queue, setQueue] = useState<DueReminderItem[]>([]);
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  const onMarkFiredRef = useRef(onMarkReminderFired);
  onMarkFiredRef.current = onMarkReminderFired;

  const notifiedKeysRef = useRef<Set<string>>(new Set());

  const scanNow = useCallback(() => {
    if (!hydrated || !enabled) return;

    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const newItems: DueReminderItem[] = [];

    for (const proj of projectsRef.current) {
      if (proj.archived) continue;
      for (const task of proj.tasks) {
        if (!isReminderDueForWindow(task, now)) continue;
        const firedKey = `${proj.id}_${task.id}_${task.reminderAt.trim()}_${
          /^\d{1,2}:\d{2}$/.test(task.reminderAt.trim()) ? dateKey : 'iso'
        }`;
        if (notifiedKeysRef.current.has(firedKey)) continue;

        notifiedKeysRef.current.add(firedKey);
        const firedIso = now.toISOString();
        onMarkFiredRef.current(proj.id, task.id, firedIso);
        void triggerDesktopReminderNotification(proj.name, task.title);

        newItems.push({
          projectId: proj.id,
          projectName: proj.name,
          projectColor: proj.accentColor || '#E5A93C',
          task: { ...task, lastReminderFiredAt: firedIso },
          firedKey
        });
      }
    }

    if (newItems.length > 0) {
      setQueue((prev) => {
        const existingKeys = new Set(prev.map((q) => q.firedKey));
        const uniqueNew = newItems.filter((it) => !existingKeys.has(it.firedKey));
        return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
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

  // Sofortiges Nachprüfen nach Projekt-/Task-Änderungen (z. B. Speichern einer fälligen Zeit)
  useEffect(() => {
    if (!hydrated || !enabled) return;
    scanNow();
  }, [projects, hydrated, enabled, scanNow]);

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
