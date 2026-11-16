import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const base = process.env.APP_URL || new URL(req.url).origin;
  const code = req.nextUrl.searchParams.get("caso") ?? "";
  if (!/^[a-zA-Z0-9-]{3,100}$/.test(code))
    return new NextResponse("Enlace inválido", { status: 400 });
  const session = await getSession();
  if (!session || (session.user.totpEnabledAt && !session.twoFactorVerified)) {
    const response = NextResponse.redirect(
      new URL(session ? "/verificar" : "/ingresar", base),
    );
    response.cookies.set("somosguafra_after", `/soporte/abrir?caso=${code}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 1800,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const db = getDb();
  const contact = await db.contactMessage.findFirst({
      where: { code, userId: session.user.id },
      select: { id: true },
    }),
    ticket = contact
      ? null
      : await db.supportTicket.findFirst({
          where: { code, userId: session.user.id },
          select: { id: true },
        });
  if (!contact && !ticket)
    return new NextResponse("No encontramos este caso en tu cuenta.", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  return NextResponse.redirect(
    new URL(`/app/ayuda?chat=${encodeURIComponent(code)}`, base),
  );
}
