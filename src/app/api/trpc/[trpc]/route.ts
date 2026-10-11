import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/api/root';
import { createTRPCContext } from '@/server/api/trpc';

// Two sequential AI calls can take a while; give the route room (seconds).
export const maxDuration = 120;

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError: ({ path, error }) => {
      console.error(`[trpc] ${path ?? '<no-path>'}: ${error.message}`);
    },
  });

export { handler as GET, handler as POST };
