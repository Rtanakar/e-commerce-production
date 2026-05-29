// ============================================================================
// google.service.ts - OAuth login orchestration
// ============================================================================
// Flow:
//   1. Find user by (provider, providerAccountId)
//      - Found → sign them in (return tokens)
//   2. Not found → check email exists
//      - If email exists with password → LINK the OAuth account
//      - If email doesn't exist → create new user
//   3. Issue tokens (same flow as login)
//
// Industry pattern: "account merging by verified email"
//   - Google email is verified → trustworthy → link to existing user safely
// ============================================================================

import * as authRepo from "../auth.repository.js";
import * as tokens from "../../../lib/tokens.js";
import type { GoogleProfile } from "./google.js";
import { prisma } from "../../../db/prisma.js";
import { logger } from "../../../utils/logger.js";
import type { AuthResponseDto } from "../auth.validator.js";

const PROVIDER = "google";

export async function loginWithGoogle(
  profile: GoogleProfile,
  context: { ip: string | null; ua?: string | null; fingerprint?: string },
): Promise<AuthResponseDto & { sid: string }> {
  // ----- 1. Already linked? Sign in immediately -----
  const existing = await authRepo.findUserByOAuth(PROVIDER, profile.sub);
  if (existing) {
    await authRepo.updateLastLogin(existing.id, context.ip);
    const sess = await tokens.createSession(
      { id: existing.id, email: existing.email, role: existing.role },
      { ip: context.ip, ua: context.ua ?? null, fingerprint: context.fingerprint },
    );
    logger.info({ userId: existing.id, provider: PROVIDER }, "OAuth sign-in (existing)");
    return {
      user: {
        id: existing.id,
        email: existing.email,
        name: existing.name,
        role: existing.role,
      },
      tokens: { accessToken: sess.accessToken, refreshToken: sess.refreshToken },
      sid: sess.sid,
    };
  }

  // ----- 2. Email exists? Link the account -----
  // SECURITY: Google has verified the email. Linking is safe.
  // (If you want strict separation, skip this step and throw "email already exists")
  const userByEmail = await prisma.user.findUnique({
    where: { email: profile.email },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  if (userByEmail) {
    await authRepo.linkOAuthAccount({
      userId: userByEmail.id,
      provider: PROVIDER,
      providerAccountId: profile.sub,
      email: profile.email,
      name: profile.name,
      image: profile.picture,
    });
    await authRepo.updateLastLogin(userByEmail.id, context.ip);

    const sess = await tokens.createSession(
      { id: userByEmail.id, email: userByEmail.email, role: userByEmail.role },
      { ip: context.ip, ua: context.ua ?? null, fingerprint: context.fingerprint },
    );
    logger.info({ userId: userByEmail.id }, "OAuth linked to existing user");
    return {
      user: {
        id: userByEmail.id,
        email: userByEmail.email,
        name: userByEmail.name,
        role: userByEmail.role,
      },
      tokens: { accessToken: sess.accessToken, refreshToken: sess.refreshToken },
      sid: sess.sid,
    };
  }

  // ----- 3. New user - create from OAuth profile -----
  const user = await authRepo.createUserFromOAuth({
    email: profile.email,
    name: profile.name ?? profile.email.split("@")[0]!,
    image: profile.picture,
    provider: PROVIDER,
    providerAccountId: profile.sub,
  });

  await authRepo.updateLastLogin(user.id, context.ip);
  const sess = await tokens.createSession(
    { id: user.id, email: user.email, role: user.role },
    { ip: context.ip, ua: context.ua ?? null, fingerprint: context.fingerprint },
  );

  logger.info({ userId: user.id }, "OAuth sign-up (new user)");
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tokens: { accessToken: sess.accessToken, refreshToken: sess.refreshToken },
    sid: sess.sid,
  };
}
