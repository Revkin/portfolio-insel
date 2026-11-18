import type { Project, ProjectColor } from './types.ts';

/**
 * Portfolio projects. One portal is generated per entry, in this order along
 * the path – adding a project never requires changes to the world code.
 *
 * PLACEHOLDERS: Kevin will supply the real projects later. Do not invent
 * content about his work here.
 */
const COLORS: ProjectColor[] = ['cyan', 'magenta', 'violet', 'amber', 'lime'];

function placeholder(n: number): Project {
  return {
    id: `placeholder-${n}`,
    color: COLORS[(n - 1) % COLORS.length] ?? 'cyan',
    title: { de: `Platzhalter-Projekt ${n}`, en: `Placeholder project ${n}` },
    summary: {
      de: 'Platzhalter: Hier steht später eine Kurzbeschreibung des Projekts in ein bis zwei Sätzen.',
      en: 'Placeholder: a one- or two-sentence summary of the project will appear here.',
    },
    description: {
      de: 'Platzhalter für die ausführliche Projektbeschreibung: Ausgangslage, Ziel, Vorgehen und Ergebnis.\n\nDieser Text wird ersetzt, sobald Kevin die echten Inhalte liefert.',
      en: 'Placeholder for the detailed project description: context, goal, approach and outcome.\n\nThis text will be replaced as soon as Kevin provides the real content.',
    },
    role: {
      de: 'Platzhalter: Was Kevin in diesem Projekt konkret gemacht hat.',
      en: 'Placeholder: what Kevin specifically did in this project.',
    },
    period: '20XX',
    tags: ['Tag A', 'Tag B', 'Tag C'],
    media: [],
  };
}

export const PROJECTS: Project[] = [1, 2, 3, 4, 5].map(placeholder);

export function getProject(id: string | null): Project | undefined {
  return id === null ? undefined : PROJECTS.find((p) => p.id === id);
}
