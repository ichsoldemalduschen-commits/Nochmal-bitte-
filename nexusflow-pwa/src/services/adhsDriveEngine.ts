import { EnergyLevel, ShoulderTapTone, TaskItem } from '../types';
import { parseReminderDate } from './cloudSyncAndPush';

function parseHHMMToMinutes(hhmm: string): number | null {
  const match = String(hhmm || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Prüft, ob ein Zeitpunkt innerhalb des konfigurierten Ruhezeit-Fensters liegt
 * (inkl. Über-Mitternacht-Fenster wie 22:00 bis 08:00 und Tagesfenster wie 13:00 bis 15:00).
 */
export function isWithinQuietHours(
  now: Date,
  startHHMM: string,
  endHHMM: string
): boolean {
  const startMin = parseHHMMToMinutes(startHHMM);
  const endMin = parseHHMMToMinutes(endHHMM);
  if (startMin === null || endMin === null || startMin === endMin) {
    return false;
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (startMin < endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  return nowMin >= startMin || nowMin < endMin;
}

/**
 * Berechnet die schuldfreie Schultertipp-Stufe anhand der Fälligkeits-Überschreitung:
 * 0 = noch nicht fällig, 1 = 0-14 Min, 2 = 15-44 Min, 3 = 45-89 Min, 4 = >= 90 Min.
 */
export function computeShoulderTapStage(
  reminderAt: string,
  now: Date = new Date()
): 0 | 1 | 2 | 3 | 4 {
  const dueDate = parseReminderDate(reminderAt, now);
  if (!dueDate) return 0;

  const diffMs = now.getTime() - dueDate.getTime();
  if (diffMs < 0) return 0;

  const diffMin = diffMs / 60_000;
  if (diffMin < 15) return 1;
  if (diffMin < 45) return 2;
  if (diffMin < 90) return 3;
  return 4;
}

/**
 * Liefert ruhige, schuldfreie Texte für die jeweilige Schultertipp-Stufe und den Tonfall.
 */
export function getShoulderTapCopy(
  stage: 1 | 2 | 3 | 4,
  tone: ShoulderTapTone,
  taskTitle: string
): { stageLabel: string; message: string } {
  const cleanTitle = (taskTitle || '').replace(/^\[[^\]]+\]\s*/, '').trim() || 'Aufgabe';
  const stageLabel = `Stufe ${stage}/4`;

  if (tone === 'direct') {
    switch (stage) {
      case 1:
        return {
          stageLabel,
          message: `Anstoß: „${cleanTitle}“ ist jetzt dran – direkt abhaken oder kurz schieben?`
        };
      case 2:
        return {
          stageLabel,
          message: `Kurz anpacken: „${cleanTitle}“ wartet noch – jetzt abhaken oder bewusst +30 Min?`
        };
      case 3:
        return {
          stageLabel,
          message: `Fokus-Check: „${cleanTitle}“ ist noch offen – jetzt durchziehen oder neu planen?`
        };
      case 4:
        return {
          stageLabel,
          message: `Klarer Schultertipp: „${cleanTitle}“ braucht eine Entscheidung – jetzt erledigen oder +30 Min?`
        };
    }
  }

  switch (stage) {
    case 1:
      return {
        stageLabel,
        message: `Erster ruhiger Impuls: „${cleanTitle}“ steht an – 5 Minuten reinstarten oder kurz schieben?`
      };
    case 2:
      return {
        stageLabel,
        message: `Kein Druck – willst du 5 Minuten an „${cleanTitle}“ reinstarten oder kurz schieben?`
      };
    case 3:
      return {
        stageLabel,
        message: `Ruhiger Fokus-Impuls: „${cleanTitle}“ wartet noch – kleiner Einstieg oder +30 Min?`
      };
    case 4:
      return {
        stageLabel,
        message: `Festnagel-Schultertipp: „${cleanTitle}“ liegt noch bereit – jetzt 5 Minuten anpacken oder bewusst schieben.`
      };
  }
}

/**
 * Wählt zufällig eine offene Aufgabe aus dem „Schweinehund-Pool“ (mit Energie-Priorisierung)
 * und vermeidet nach Möglichkeit die aktuell angezeigte Aufgabe.
 */
export function rollHurdleTask(
  tasks: TaskItem[],
  currentTaskId?: string | null,
  activeEnergy: EnergyLevel | 'all' = 'all'
): TaskItem | null {
  const openTasks = tasks.filter((t) => !t.completed);
  if (openTasks.length === 0) return null;

  const matchesEnergy = (t: TaskItem) =>
    activeEnergy === 'all' || (t.energyLevel ?? 'medium') === activeEnergy;

  const hurdleMatching = openTasks.filter((t) => t.isHurdleTask === true && matchesEnergy(t));
  const hurdleAny = openTasks.filter((t) => t.isHurdleTask === true);
  const energyMatching = openTasks.filter((t) => matchesEnergy(t));

  const tiers = [hurdleMatching, hurdleAny, energyMatching, openTasks];
  let chosenPool: TaskItem[] = openTasks;

  for (const tier of tiers) {
    if (tier.length === 0) continue;
    const withoutCurrent =
      currentTaskId && openTasks.length >= 2
        ? tier.filter((t) => t.id !== currentTaskId)
        : tier;
    if (withoutCurrent.length > 0) {
      chosenPool = withoutCurrent;
      break;
    }
  }

  const index = Math.floor(Math.random() * chosenPool.length);
  return chosenPool[index] || openTasks[0] || null;
}

/**
 * Filtert Aufgaben deterministisch nach Energielevel (unmarkierte Altaufgaben gelten als 'medium').
 */
export function filterTasksByEnergy(
  tasks: TaskItem[],
  energyFilter: EnergyLevel | 'all'
): TaskItem[] {
  if (energyFilter === 'all') return tasks;
  return tasks.filter((t) => (t.energyLevel ?? 'medium') === energyFilter);
}

