'use client';

import App from '@/lib/mp4Creater/App';

export default function ClientOnlyApp(props: { routeStep?: 1 | 2 | 3 | 4 | 5 | null }) {
  return <App routeStep={props.routeStep ?? null} />;
}
