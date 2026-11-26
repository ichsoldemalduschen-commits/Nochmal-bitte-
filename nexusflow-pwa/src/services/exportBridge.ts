import { EventSalesLog, Project } from '../types';
import { parseReminderDate } from './cloudSyncAndPush';

export function exportEventSalesToCsv(logs: EventSalesLog[]): void {
  const header = [
    'Datum_Uhrzeit',
    'Event_Name',
    'Pizzen_Gesamt',
    'Umsatz_Brutto_EUR',
    'Wareneinsatz_EUR',
    'Rohertrag_EUR',
    'Feuerwehrauto_Fonds_Trinkgeld_EUR',
    'Sorten_Aufschluesselung'
  ];

  const rows = logs.map((l) => {
    const breakdown = l.items.map((i) => `${i.name}: ${i.count}x`).join(' | ');
    return [
      `"${l.timestamp}"`,
      `"${l.eventName.replace(/"/g, '""')}"`,
      l.totalPizzas,
      l.grossRevenue.toFixed(2).replace('.', ','),
      l.cogsTotal.toFixed(2).replace('.', ','),
      l.grossProfit.toFixed(2).replace('.', ','),
      l.firetruckTipFund.toFixed(2).replace('.', ','),
      `"${breakdown}"`
    ].join(';');
  });

  const csvContent = '\uFEFF' + [header.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pizza-bandit-abrechnungen-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatIcsLocalDateTime(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}${mo}${d}T${h}${mi}${s}`;
}

export function exportScheduledTasksToIcs(projects: Project[]): number {
  const blockTimes: Record<string, { start: string; end: string }> = {
    morning: { start: '063000', end: '083000' },
    focus: { start: '100000', end: '120000' },
    errands: { start: '150000', end: '163000' },
    evening: { start: '183000', end: '193000' }
  };

  const todayCompact = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NexusFlow//Modular Workflow PWA//DE'
  ];

  let count = 0;
  projects
    .filter((p) => !p.archived)
    .forEach((proj) => {
      proj.tasks.forEach((t, idx) => {
        if (t.completed) return;
        const hasExplicitIsoReminder = Boolean(t.reminderAt && (t.reminderAt.includes('T') || t.reminderAt.includes('-')));
        const parsedReminder = hasExplicitIsoReminder ? parseReminderDate(t.reminderAt) : null;
        const slot = blockTimes[t.dayBlock ?? 'focus'] || blockTimes.focus;
        const dtStart = parsedReminder
          ? formatIcsLocalDateTime(parsedReminder)
          : `${todayCompact}T${slot.start}`;
        const dtEnd = parsedReminder
          ? formatIcsLocalDateTime(new Date(parsedReminder.getTime() + (t.estimatedMinutes || 30) * 60_000))
          : `${todayCompact}T${slot.end}`;

        count++;
        lines.push(
          'BEGIN:VEVENT',
          `UID:nexusflow-${t.id}-${idx}@local`,
          `DTSTAMP:${todayCompact}T060000`,
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `SUMMARY:[${proj.name}] ${t.title}`,
          `DESCRIPTION:Prioritaet: ${t.priority} | Dauer: ${t.estimatedMinutes} Min.`,
          'END:VEVENT'
        );
      });
    });

  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nexusflow-tagesplan.ics';
  a.click();
  URL.revokeObjectURL(url);
  return count;
}

export const exportDayPlanIcs = exportScheduledTasksToIcs;
export const exportSalesLogsCsv = exportEventSalesToCsv;
