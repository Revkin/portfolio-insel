import { useEffect, useMemo } from 'react';
import { Game } from './Game.tsx';
import { Hud } from './ui/Hud.tsx';
import { ProjectOverlay } from './ui/ProjectOverlay.tsx';
import { PROJECTS } from './content/projects.ts';
import { getShotFromUrl } from './systems/shots.ts';
import { initInput, onAction } from './systems/input.ts';
import { useGame } from './systems/store.ts';
import './ui/ui.css';

export function App() {
  const shot = useMemo(() => getShotFromUrl(), []);
  const lang = useGame((s) => s.lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => initInput(), []);

  // E opens the portal the player stands at.
  useEffect(
    () =>
      onAction((code) => {
        if (code !== 'KeyE') return;
        const s = useGame.getState();
        if (s.openProjectId === null && s.nearPortalId !== null) s.openProject(s.nearPortalId);
      }),
    [],
  );

  useEffect(() => {
    const cfg = shot?.config;
    if (cfg?.openOverlay && typeof cfg.player === 'object') {
      const project = PROJECTS[cfg.player.portalIndex];
      if (project) useGame.getState().openProject(project.id);
    }
  }, [shot]);

  return (
    <>
      <Game shot={shot?.config ?? null} />
      <Hud />
      <ProjectOverlay />
    </>
  );
}
