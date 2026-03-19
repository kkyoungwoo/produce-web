import { redirect } from 'next/navigation';
import ClientOnlyApp from './ClientOnlyApp';

export default async function Mp4CreaterPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const viewParam = searchParams?.view;
  const view = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  if (view === 'main') {
    redirect('?view=gallery');
  }

  return <ClientOnlyApp />;
}
