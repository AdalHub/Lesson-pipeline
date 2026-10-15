import { Fredoka, Nunito } from 'next/font/google';

/**
 * The Paper lesson deck uses Fredoka for display type and Nunito for body
 * copy. Declared here, not in the root layout, so only lesson pages load them.
 * The CSS variables are consumed by --font-slide-display / --font-slide-body.
 */
export const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-fredoka',
  display: 'swap',
});

export const nunito = Nunito({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-nunito',
  display: 'swap',
});
