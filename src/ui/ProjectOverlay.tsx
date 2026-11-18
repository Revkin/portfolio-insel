import { useEffect, useRef, type CSSProperties } from 'react';
import { pick } from '../content/i18n.ts';
import { getProject } from '../content/projects.ts';
import { PROJECT_COLORS } from '../content/palette.ts';
import { useGame } from '../systems/store.ts';
import { useI18n } from '../systems/useI18n.ts';

/** Project details on the right half of the screen (final styling in Phase 7). */
export function ProjectOverlay() {
  const { lang, t } = useI18n();
  const openProjectId = useGame((s) => s.openProjectId);
  const closeProject = useGame((s) => s.closeProject);
  const project = getProject(openProjectId);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!project) return;
    if (document.pointerLockElement) document.exitPointerLock();
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        closeProject();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [project, closeProject]);

  if (!project) return null;

  const titleId = `overlay-title-${project.id}`;
  const paragraphs = pick(project.description, lang).split(/\n\s*\n/);

  return (
    <aside
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="project-overlay"
      style={{ '--accent': PROJECT_COLORS[project.color] } as CSSProperties}
    >
      <header className="overlay-header">
        <h2 id={titleId} className="overlay-title">
          {pick(project.title, lang)}
        </h2>
        <button ref={closeButton} type="button" className="overlay-close" onClick={closeProject}>
          {t('overlay.close')} <kbd>{t('overlay.closeHint')}</kbd>
        </button>
      </header>

      <div className="overlay-media">
        {project.media.length === 0 ? (
          <div className="overlay-media-placeholder">{t('overlay.mediaPlaceholder')}</div>
        ) : (
          project.media.map((m) =>
            m.type === 'image' ? (
              <img key={m.src} src={m.src} alt={pick(m.alt, lang)} loading="lazy" />
            ) : (
              <video key={m.src} src={m.src} aria-label={pick(m.alt, lang)} controls muted playsInline />
            ),
          )
        )}
      </div>

      <p className="overlay-summary">{pick(project.summary, lang)}</p>
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}

      <h3>{t('overlay.role')}</h3>
      <p>{pick(project.role, lang)}</p>

      {project.period && (
        <p className="overlay-period">
          {t('overlay.period')}: {project.period}
        </p>
      )}

      <h3>{t('overlay.tags')}</h3>
      <ul className="overlay-tags">
        {project.tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>

      {(project.links?.github || project.links?.demo) && (
        <div className="overlay-links">
          {project.links.github && (
            <a href={project.links.github} target="_blank" rel="noopener noreferrer">
              {t('overlay.github')}
            </a>
          )}
          {project.links.demo && (
            <a className="primary" href={project.links.demo} target="_blank" rel="noopener noreferrer">
              {t('overlay.demo')}
            </a>
          )}
        </div>
      )}
    </aside>
  );
}
