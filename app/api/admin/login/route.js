import { setSessionCookie } from "@/lib/auth";

export async function POST(request) {
  const { password } = await request.json().catch(() => ({}));
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return Response.json(
      { error: "ADMIN_PASSWORD not configured" },
      { status: 500 }
    );
  }
  if (typeof password !== "string") {
    return Response.json({ error: "Password required" }, { status: 400 });
  }
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) {
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }
  await setSessionCookie();
  return Response.json({ ok: true });
}
