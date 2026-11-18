import type { CSSProperties, MouseEvent } from 'react';
import { LANGS, pick } from '../content/i18n.ts';
import { getProject } from '../content/projects.ts';
import { PROJECT_COLORS } from '../content/palette.ts';
import { useGame } from '../systems/store.ts';
import { useI18n } from '../systems/useI18n.ts';
import { StaminaBar } from './StaminaBar.tsx';

export function Hud() {
  const { lang, setLang, t } = useI18n();
  const nearPortalId = useGame((s) => s.nearPortalId);
  const openProjectId = useGame((s) => s.openProjectId);
  const pointerLocked = useGame((s) => s.pointerLocked);
  const near = getProject(nearPortalId);

  const onLangClick = (e: MouseEvent<HTMLButtonElement>, next: typeof lang) => {
    setLang(next);
    // After a mouse click, give keyboard focus back to the game (Space = jump).
    if (e.detail > 0) e.currentTarget.blur();
  };

  return (
    <div className="hud">
      <nav className="hud-lang" aria-label={t('hud.language')}>
        {LANGS.map((l, i) => (
          <span key={l}>
            {i > 0 && <span className="hud-lang-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              className="hud-lang-btn"
              aria-pressed={lang === l}
              lang={l}
              onClick={(e) => onLangClick(e, l)}
            >
              {l.toUpperCase()}
            </button>
          </span>
        ))}
      </nav>

      {near && openProjectId === null && (
        <div
          className="hud-prompt"
          data-testid="interact-prompt"
          style={{ '--accent': PROJECT_COLORS[near.color] } as CSSProperties}
        >
          <kbd>E</kbd>
          <span>– {t('portal.open')}</span>
          <span className="hud-prompt-title">{pick(near.title, lang)}</span>
        </div>
      )}

      <StaminaBar />

      {openProjectId === null && (
        <div className="hud-hints">
          {!pointerLocked && <p>{t('hud.clickToLook')}</p>}
          <p>{t('hud.controls')}</p>
        </div>
      )}
    </div>
  );
}
