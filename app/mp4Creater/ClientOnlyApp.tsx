'use client';

import React from 'react';
import App from '@/lib/mp4Creater/App';

export default function ClientOnlyApp(props: { routeStep?: 1 | 2 | 3 | 4 | 5 | null }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-slate-50" suppressHydrationWarning />;
  }

  return <App routeStep={props.routeStep ?? null} />;
}
