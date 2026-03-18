import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

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
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async signIn({ user }: any) {
      if (!user.email) return false;
      // Allow BU domain
      if (user.email.endsWith(`@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN}`)) return true;
      // Allow explicitly listed test emails
      const testEmails = process.env.ALLOWED_TEST_EMAILS?.split(',').map((e) => e.trim()) || [];
      if (testEmails.includes(user.email)) return true;
      return false;
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
