import { handleTrack } from '../server/handlers';

export const POST = (req: Request) => handleTrack(req);
