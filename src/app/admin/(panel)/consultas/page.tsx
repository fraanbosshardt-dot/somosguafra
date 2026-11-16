import { redirect } from "next/navigation";
// The old entry point keeps filters and opens the same cases in the unified inbox.
export default async function Inquiries({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  const state =
    p.ver === "cerradas"
      ? "CLOSED"
      : p.ver === "respondidas"
        ? "ANSWERED"
        : p.ver === "todas"
          ? "all"
          : "open";
  const query = new URLSearchParams({
    canal: "contact",
    estado: state,
    q: p.q ?? "",
    area: p.area ?? "",
    pagina: p.pagina ?? "1",
  });
  redirect(`/admin/soporte?${query}`);
}
