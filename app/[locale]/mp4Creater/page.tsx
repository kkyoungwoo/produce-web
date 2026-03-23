
import { redirect } from 'next/navigation';
import { buildQueryString, type SearchParamsRecord } from './redirect-utils';

export default async function LegacyLocaleMp4CreaterPage(props: { searchParams?: Promise<SearchParamsRecord>; }) {
  const searchParams = await props.searchParams;
  redirect(`/mp4Creater${buildQueryString(searchParams)}`);
}
