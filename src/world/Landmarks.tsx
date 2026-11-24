import { House } from './House.tsx';
import { Windmill } from './Windmill.tsx';
import { Dock } from './Dock.tsx';
import { Skyline } from './Skyline.tsx';

/** Buildings and the city on the horizon. */
export function Landmarks() {
  return (
    <group>
      <House />
      <Windmill />
      <Dock />
      <Skyline />
    </group>
  );
}
