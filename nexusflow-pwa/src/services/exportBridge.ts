import { EventSalesLog, Project } from '../types';

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

export async function copyEventSalesAsTsvForSheets(logs: EventSalesLog[]): Promise<boolean> {
  const header = [
    'Zeitstempel',
    'Event',
    'Pizzen',
    'Umsatz (€)',
    'Wareneinsatz (€)',
    'Rohertrag (€)',
    'Feuerwehrauto-Fonds (€)',
    'Sorten'
  ].join('\t');

  const lines = logs.map((l) =>
    [
      l.timestamp,
      l.eventName,
      l.totalPizzas,
      l.grossRevenue.toFixed(2).replace('.', ','),
      l.cogsTotal.toFixed(2).replace('.', ','),
      l.grossProfit.toFixed(2).replace('.', ','),
      l.firetruckTipFund.toFixed(2).replace('.', ','),
      l.items.map((i) => `${i.name} (${i.count}x)`).join(', ')
    ].join('\t')
  );

  const tsv = [header, ...lines].join('\n');
  try {
    await navigator.clipboard.writeText(tsv);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = tsv;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  }
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
        if (!t.dayBlock || t.completed) return;
        const slot = blockTimes[t.dayBlock] || blockTimes.focus;
        count++;
        lines.push(
          'BEGIN:VEVENT',
          `UID:nexusflow-${t.id}-${idx}@local`,
          `DTSTAMP:${todayCompact}T060000`,
          `DTSTART:${todayCompact}T${slot.start}`,
          `DTEND:${todayCompact}T${slot.end}`,
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