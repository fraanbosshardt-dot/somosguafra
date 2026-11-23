import { randomUUID } from "node:crypto";
import type { Db } from "./ledger";
import { UserError } from "./ledger";
import { lockWorkspace } from "./workspace-lock";
import { effectivePlan, hasFeature } from "./plans";
import { experienceFrom, plainConcept, type Favorite, type CategoryRule } from "@/lib/experience";

export async function saveExperience(db: Db, ws: string, action: "favorite" | "rule" | "removeFavorite" | "removeRule", input: { id?: string; name?: string; kind?: string; accountId?: string; categoryId?: string }) {
  return db.$transaction(async tx => {
    await lockWorkspace(tx, ws);
    const space = await tx.workspace.findUniqueOrThrow({ where: { id: ws }, include: { subscription: true } });
    const prefs = experienceFrom(space.modules);
    if (action === "removeFavorite") prefs.favorites = prefs.favorites.filter(f => f.id !== input.id);
    else if (action === "removeRule") prefs.rules = prefs.rules.filter(r => r.id !== input.id);
    else {
      if (input.kind !== "INCOME" && input.kind !== "EXPENSE") throw new UserError("Elegí gasto o ingreso.");
      const name = (input.name ?? "").trim();
      if (name.length < (action === "rule" ? 3 : 1) || name.length > 80) throw new UserError("Revisá el nombre: hasta 80 caracteres; una regla necesita al menos 3.");
      const categoryId = input.categoryId || null;
      if (categoryId && !await tx.category.findFirst({ where: { id: categoryId, workspaceId: ws, archived: false, kind: input.kind } })) throw new UserError("Elegí una categoría activa de este espacio.");
      if (action === "favorite") {
        const acc = await tx.account.findFirst({ where: { id: input.accountId, workspaceId: ws, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } } });
        if (!input.accountId || !acc) throw new UserError("Elegí una cuenta activa de dinero de este espacio.");
        const same = prefs.favorites.find(f => plainConcept(f.name) === plainConcept(name) && f.kind === input.kind);
        if (!same && prefs.favorites.length >= 20) throw new UserError("Podés guardar hasta 20 favoritos. Quitá uno para agregar otro.");
        const favorite: Favorite = { id: same?.id ?? randomUUID(), name, kind: input.kind, accountId: acc.id, categoryId };
        prefs.favorites = [...prefs.favorites.filter(f => f.id !== favorite.id), favorite];
      } else {
        if (!await hasFeature(tx, effectivePlan(space.subscription), "informes")) throw new UserError("Las reglas personales son parte de Pro.");
        if (!categoryId) throw new UserError("Elegí la categoría que querés sugerir.");
        const same = prefs.rules.find(r => plainConcept(r.contains) === plainConcept(name) && r.kind === input.kind);
        if (!same && prefs.rules.length >= 30) throw new UserError("Podés guardar hasta 30 reglas. Quitá una para agregar otra.");
        const rule: CategoryRule = { id: same?.id ?? randomUUID(), contains: name, kind: input.kind, categoryId };
        prefs.rules = [...prefs.rules.filter(r => r.id !== rule.id), rule];
      }
    }
    const current = space.modules && typeof space.modules === "object" && !Array.isArray(space.modules) ? space.modules as Record<string, never> : {};
    await tx.workspace.update({ where: { id: ws }, data: { modules: { ...current, _experience: prefs } } });
    return prefs;
  });
}
