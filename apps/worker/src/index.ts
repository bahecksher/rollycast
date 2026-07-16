import { generateRoomCode } from '@rollycast/shared';
import { routePartykitRequest } from 'partyserver';
import { RoomServer } from './server';

export { RoomServer };

const CREATE_ROOM_PATH = '/api/rooms';
const MAX_CODE_ATTEMPTS = 8;

async function routeRoomRequest(
  request: Request,
  env: Env,
  code: string,
  method: 'GET' | 'POST',
): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = `/parties/room/${code}`;
  url.search = '';
  const response = await routePartykitRequest(new Request(url, { method }), env);
  return response ?? new Response('Room route unavailable', { status: 500 });
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateRoomCode();
    const lookup = await routeRoomRequest(request, env, code, 'GET');
    const status = (await lookup.json()) as { exists?: boolean };
    if (status.exists) continue;

    const created = await routeRoomRequest(request, env, code, 'POST');
    if (!created.ok) return created;
    return Response.json({ code, roomUrl: `/room/${code}` }, { status: 201 });
  }
  return Response.json({ error: 'Unable to allocate a room code' }, { status: 503 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === CREATE_ROOM_PATH) {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
      }
      return createRoom(request, env);
    }

    return (await routePartykitRequest(request, env)) ?? new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
