import { AdminSupportInbox } from "@/components/admin-support-inbox";
export const metadata = { title: "Consultas del sitio" };
export default function Inquiries(props: {searchParams:Promise<Record<string,string|undefined>>}) {return <AdminSupportInbox {...props} scope="site"/>;}
