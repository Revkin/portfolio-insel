import { Canvas } from '@react-three/fiber';
import { EmptyScene } from './world/EmptyScene.tsx';
import { getShot } from './systems/shots.ts';

export function App() {
  const shot = getShot();

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 50, near: 0.1, far: 2000, position: shot.camera }}
      gl={{ antialias: true, preserveDrawingBuffer: shot.isScreenshot }}
    >
      <EmptyScene target={shot.target} />
    </Canvas>
  );
}
