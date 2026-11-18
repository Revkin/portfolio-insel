export type Lang = 'de' | 'en';

export type Localized = { de: string; en: string };

export type ProjectColor = 'cyan' | 'magenta' | 'violet' | 'amber' | 'lime';

export interface ProjectMedia {
  type: 'image' | 'video';
  src: string;
  alt: Localized;
}

export interface ProjectLinks {
  github?: string;
  demo?: string;
  other?: { label: Localized; url: string }[];
}

export interface Project {
  id: string;
  color: ProjectColor;
  title: Localized;
  /** 1–2 sentences, used on the hologram and the 2D card. */
  summary: Localized;
  /** Long form; paragraphs separated by blank lines. */
  description: Localized;
  /** What Kevin did on the project. */
  role: Localized;
  period?: string;
  tags: string[];
  media: ProjectMedia[];
  links?: ProjectLinks;
}
