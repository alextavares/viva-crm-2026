import ContactsPage from "../page"

export default async function SiteContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  return ContactsPage({
    searchParams: Promise.resolve({
      ...params,
      origin: "site",
      scope: "site",
    }),
  })
}
