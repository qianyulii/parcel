import { handleLogin } from '../server/handlers';

export const GET = (req: Request) => handleLogin(req);
export const POST = (req: Request) => handleLogin(req);
