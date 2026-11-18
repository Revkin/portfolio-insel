import { useEffect, useRef } from 'react';
import { playerState } from '../player/playerState.ts';
import { useI18n } from '../systems/useI18n.ts';

/**
 * Slim stamina bar at the bottom, only visible while stamina is used or
 * refilling. Updated per animation frame without React re-renders.
 */
export function StaminaBar() {
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    let lastVisible = false;
    let lastPercent = -1;
    const tick = () => {
      const el = root.current;
      const bar = fill.current;
      if (el && bar) {
        const s = playerState.stamina;
        const visible = s < 0.999 || playerState.mode === 'climb';
        if (visible !== lastVisible) {
          el.dataset.visible = String(visible);
          lastVisible = visible;
        }
        const percent = Math.round(s * 1000) / 10;
        if (percent !== lastPercent) {
          bar.style.transform = `scaleX(${s})`;
          el.setAttribute('aria-valuenow', String(Math.round(s * 100)));
          lastPercent = percent;
        }
        el.dataset.exhausted = String(playerState.exhausted);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={root}
      className="stamina"
      role="progressbar"
      aria-label={t('hud.stamina')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={100}
      data-visible="false"
      data-testid="stamina"
    >
      <div className="stamina-track">
        <div ref={fill} className="stamina-fill" />
      </div>
      <span className="stamina-label">{t('hud.stamina')}</span>
    </div>
  );
}
