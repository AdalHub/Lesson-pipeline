'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MascotFace } from './Mascot';

export function AppHeader() {
  const pathname = usePathname();
  const historyActive = pathname.startsWith('/lessons');

  return (
    <header className="border-b-2 border-foreground bg-card">
      <nav className="mx-auto flex h-[74px] w-full max-w-[1180px] items-center justify-between px-5 sm:px-8 lg:px-0">
        <Link
          href="/"
          aria-label="Lesson Pipeline home"
          className="group flex items-center gap-3 font-bold tracking-[-0.025em]"
        >
          <MascotFace className="h-[40px] w-[40px] drop-shadow-[0_5px_6px_rgba(222,40,110,0.28)] transition-transform group-hover:-rotate-6" />
          <span className="hidden text-lg sm:block">Lesson Pipeline</span>
        </Link>
        <div className="flex items-center gap-1 text-sm font-semibold">
          <Link
            href="/"
            aria-current={!historyActive ? 'page' : undefined}
            className={`rounded-full px-4 py-2.5 transition-colors ${
              !historyActive ? 'bg-accent text-white' : 'hover:bg-accent-soft'
            }`}
          >
            Create
          </Link>
          <Link
            href="/lessons"
            aria-current={historyActive ? 'page' : undefined}
            className={`rounded-full px-4 py-2.5 transition-colors ${
              historyActive ? 'bg-accent text-white' : 'hover:bg-accent-soft'
            }`}
          >
            History
          </Link>
        </div>
      </nav>
    </header>
  );
}
