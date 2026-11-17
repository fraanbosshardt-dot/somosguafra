import { AdminSupportInbox } from "@/components/admin-support-inbox";
export const metadata = { title: "Conversaciones" };
export default function Inbox(props: {searchParams:Promise<Record<string,string|undefined>>}) {return <AdminSupportInbox {...props} scope="chat"/>;}
