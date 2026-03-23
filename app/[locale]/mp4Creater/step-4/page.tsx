
import { redirect } from 'next/navigation';
import { buildQueryString, type SearchParamsRecord } from '../redirect-utils';

export default async function LegacyRedirectPage(props: { searchParams?: Promise<SearchParamsRecord>; }) {
  const searchParams = await props.searchParams;
  redirect(`/mp4Creater/step-4${buildQueryString(searchParams)}`);
}
