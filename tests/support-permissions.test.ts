import {beforeEach,expect,it,vi} from "vitest";
import {can} from "@/server/admin-team";
vi.mock("server-only",()=>({}));
const state=vi.hoisted(()=>({role:"SUPPORT" as "SUPPORT"|"OWNER",db:vi.fn()}));
vi.mock("@/lib/auth/admin",()=>({
  requireAdmin:async(perm:"view"|"support"|"owner"|"operations"="view")=>{const {can}=await import("@/server/admin-team");if(!can(state.role,perm))throw Error("forbidden");return {email:"actor@audit.invalid",role:state.role,sessionId:"fixture"};},
  adminAudit:vi.fn(),destroyAdminSession:vi.fn(),createAdminSession:vi.fn(),
}));
vi.mock("@/lib/db",()=>({getDb:state.db}));
import {adminGiftProAction,adminSuspendAction,adminReset2faAction,adminCloseSessionsAction,adminAddGrantAction,adminDeleteGrantAction} from "@/app/actions/admin";
beforeEach(()=>{state.role="SUPPORT";state.db.mockReset();state.db.mockImplementation(()=>{throw Error("unexpected database access");});});
it("el rol de atención no accede a operaciones del negocio ni a cambios de dinero o seguridad",async()=>{
  expect(can("SUPPORT","operations")).toBe(false);expect(can("VIEWER","operations")).toBe(true);expect(can("OWNER","operations")).toBe(true);
  const fd=new FormData();fd.set("days","14");fd.set("userId","fixture");fd.set("workspaceId","fixture");fd.set("email","client@audit.invalid");
  for(const action of [adminGiftProAction,adminSuspendAction,adminReset2faAction,adminCloseSessionsAction,adminDeleteGrantAction])await expect(action(fd)).rejects.toThrow("forbidden");
  await expect(adminAddGrantAction(null,fd)).rejects.toThrow("forbidden");expect(state.db).not.toHaveBeenCalled();
});
