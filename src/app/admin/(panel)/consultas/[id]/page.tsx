import { AdminConversation } from "@/components/admin-conversation";
export const metadata = {title:"Consulta del sitio"};
export default async function Inquiry({params}:{params:Promise<{id:string}>}) {const {id}=await params; return <AdminConversation params={Promise.resolve({kind:"contact",id})} siteOnly/>;}
