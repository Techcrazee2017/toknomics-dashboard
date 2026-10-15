import { useEffect } from 'react';

/** Sets the tab title while the calling screen is mounted, then puts the previous one back. */
export function useTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);
}
