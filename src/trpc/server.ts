import 'server-only';

import { headers } from 'next/headers';
import { cache } from 'react';
import { createCaller } from '@/server/api/root';
import { createTRPCContext } from '@/server/api/trpc';

/** Server-side caller for React Server Components. */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set('x-trpc-source', 'rsc');
  return createTRPCContext({ headers: heads });
});

export const api = createCaller(createContext);
