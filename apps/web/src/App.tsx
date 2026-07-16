import { normalizeRoomCode } from '@rollycast/shared';
import { LandingPage } from './features/landing/LandingPage';
import { RoomPage } from './features/room/RoomPage';
import { matchRoomCode, useLocationPath } from './router';

export function App() {
  const path = useLocationPath();
  const roomCode = matchRoomCode(path);

  if (roomCode) {
    return <RoomPage code={normalizeRoomCode(decodeURIComponent(roomCode))} />;
  }
  return <LandingPage />;
}
