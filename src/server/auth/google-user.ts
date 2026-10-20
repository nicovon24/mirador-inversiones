import "server-only";
import { db } from "@/lib/db";

/** Bind accounts to Google's stable subject. Never attach a legacy row by email or browser cookie. */
export async function findOrCreateGoogleUser(identity: { sub: string; email: string }): Promise<{ id: string } | null> {
  const existing = await db.user.findUnique({ where: { googleSub: identity.sub } });
  if (existing) {
    if (existing.identityType !== "AUTHENTICATED") return null;
    if (existing.email !== identity.email) {
      const claimedEmail = await db.user.findUnique({ where: { email: identity.email } });
      if (claimedEmail && claimedEmail.id !== existing.id) return null;
      try {
        await db.user.update({ where: { id: existing.id }, data: { email: identity.email } });
      } catch {
        return null;
      }
    }
    return { id: existing.id };
  }

  // A pre-existing account with this address must be reviewed before it can be bound to a new Google sub.
  if (await db.user.findUnique({ where: { email: identity.email } })) return null;
  try {
    return await db.user.create({
      data: {
        email: identity.email,
        googleSub: identity.sub,
        identityType: "AUTHENTICATED",
        role: "USER",
      },
      select: { id: true },
    });
  } catch {
    // A concurrent first login may have won the unique constraint; the next attempt can use it.
    return null;
  }
}
