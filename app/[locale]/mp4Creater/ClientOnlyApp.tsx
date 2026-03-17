'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('@/lib/mp4Creater/App'), {
  ssr: false,
});

export default function ClientOnlyApp() {
  return <App />;
}
