import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '@/lib/prisma';

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET is not set');
}
if (!process.env.AUTH_GOOGLE_ID) {
  throw new Error('AUTH_GOOGLE_ID is not set');
}
if (!process.env.AUTH_GOOGLE_SECRET) {
  throw new Error('AUTH_GOOGLE_SECRET is not set');
}
if (!process.env.NEXT_PUBLIC_EMAIL_DOMAIN) {
  throw new Error('NEXT_PUBLIC_EMAIL_DOMAIN is not set');
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: { prompt: 'select_account' },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }: any) {
      if (!user.email) return false;
      // Allow BU domain
      const allowedDomain = `@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN}`;
      const testEmails = process.env.ALLOWED_TEST_EMAILS?.split(',').map((e) => e.trim()) || [];
      const allowed = user.email.endsWith(allowedDomain) || testEmails.includes(user.email);
      if (!allowed) return false;

      // Upsert user and sync profile picture from Google
      await prisma.user.upsert({
        where: { email: user.email },
        update: { profilePicture: user.image ?? undefined },
        create: {
          email: user.email,
          profilePicture: user.image ?? undefined,
          isAdmin: process.env.ADMIN_EMAILS?.split(',')
            .map((e) => `${e.trim()}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN}`)
            .includes(user.email) || false,
        },
      });
      return true;
    },
    async session({ session, token }: any) {
      // Add email to session for easy access
      if (session.user && token.email) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
  pages: {
    error: '/',
  },
};

export default NextAuth(authOptions);
