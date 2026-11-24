import type { Db } from "./ledger";
import { COMMUNICATION_CONSENT_VERSION, type CommunicationChoices, NO_OPTIONAL_EMAIL } from "@/lib/communication-preferences";
export async function saveCommunicationPreferences(db: Db, userId: string, choices: CommunicationChoices, source = "settings") {
  return db.$transaction(async tx => {
    const user = await tx.user.findUnique({where:{id:userId},select:{deletedAt:true,suspendedAt:true}});
    if (!user || user.deletedAt || user.suspendedAt) return false;
    await tx.communicationPreference.upsert({where:{userId},create:{userId,...choices,consentVersion:COMMUNICATION_CONSENT_VERSION},update:{...choices,consentVersion:COMMUNICATION_CONSENT_VERSION}});
    await tx.auditLog.create({data:{userId,action:"communications.preferences",meta:{...choices,source,version:COMMUNICATION_CONSENT_VERSION}}});
    // Una baja elimina incluso los borradores pendientes, no los correos de servicio.
    await tx.emailOutbox.updateMany({where:{to:(await tx.user.findUniqueOrThrow({where:{id:userId},select:{email:true}})).email,purpose:"marketing",sentAt:null,deliveryState:{in:["queued","sending"]}},data:{deliveryState:"suppressed",deliveryToken:null,lastError:"preferences-changed"}});
    return true;
  });
}
export const unsubscribeOptionalEmail = (db: Db, userId: string) => saveCommunicationPreferences(db,userId,NO_OPTIONAL_EMAIL,"unsubscribe");
