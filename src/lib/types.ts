export interface SkillCategory {
  name: string;
  items: string[];
}

export interface ExperienceRole {
  company: string;
  role: string;
  location: string;
  dateRange: string;
  bullets: string[];
  techStack: string[];
}

/** Shape of one day in src/data/contributions.json. */
export interface ContributionDay {
  date: string;
  github: number;
  gitlab: number;
}

export interface ContributionData {
  updatedAt: string | null;
  days: ContributionDay[];
  totals: {github: number; gitlab: number};
}
