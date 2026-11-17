import { AdminConversation } from "@/components/admin-conversation";
export default function Conversation(props:{params:Promise<{kind:string;id:string}>}) {return <AdminConversation {...props}/>;}
