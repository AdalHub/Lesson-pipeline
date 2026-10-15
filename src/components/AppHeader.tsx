'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppHeader() {
  const pathname = usePathname();
  const historyActive = pathname.startsWith('/lessons');

  return (
    <header className="border-b-2 border-foreground bg-card">
      <nav className="mx-auto flex h-[74px] w-full max-w-[1180px] items-center justify-between px-5 sm:px-8 lg:px-0">
        <Link href="/" className="flex items-center gap-3 font-bold tracking-[-0.025em]">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border-2 border-foreground bg-signal text-sm font-extrabold text-white">
            LP
          </span>
          <span className="hidden text-lg sm:block">Lesson Pipeline</span>
        </Link>
        <div className="flex items-center gap-1 text-sm font-semibold">
          <Link
            href="/"
            className={`rounded-full px-4 py-2.5 transition-colors ${
              !historyActive
                ? 'bg-foreground text-card'
                : 'hover:bg-background'
            }`}
          >
            Create
          </Link>
          <Link
            href="/lessons"
            className={`rounded-full px-4 py-2.5 transition-colors ${
              historyActive
                ? 'bg-foreground text-card'
                : 'hover:bg-background'
            }`}
          >
            History
          </Link>
        </div>
      </nav>
    </header>
  );
}
