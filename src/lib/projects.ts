import type {CollectionEntry} from 'astro:content';

export type Project = CollectionEntry<'projects'>;

/** Glob id minus the locale prefix — identical across translations of the same project. */
const slugOf = (entry: Project) => entry.id.split('/').slice(1).join('/');

/**
 * Newest first. The slug breaks ties, so two projects sharing a date keep the same order
 * in both locales — titles differ per language and would sort them differently.
 */
export function sortProjects(entries: Project[]): Project[] {
  return [...entries].sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf() || slugOf(a).localeCompare(slugOf(b))
  );
}

export interface ProjectGroup {
  year: number;
  projects: Project[];
}

/** Sorted projects bucketed by year, newest year first. */
export function groupByYear(entries: Project[]): ProjectGroup[] {
  const groups: ProjectGroup[] = [];
  for (const project of sortProjects(entries)) {
    // UTC, so the heading cannot shift by a day depending on the build machine's timezone.
    const year = project.data.date.getUTCFullYear();
    const last = groups[groups.length - 1];
    if (last?.year === year) last.projects.push(project);
    else groups.push({year, projects: [project]});
  }
  return groups;
}
