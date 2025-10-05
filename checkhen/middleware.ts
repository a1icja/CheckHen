// import { clerkClient, clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// if (!process.env.NEXT_PUBLIC_EMAIL_DOMAIN) {
//   throw new Error('NEXT_PUBLIC_EMAIL_DOMAIN is not set');
// }
// if (!process.env.NEXT_PUBLIC_ADMIN_EMAILS) {
//   throw new Error('NEXT_PUBLIC_ADMIN_EMAILS is not set');
// }

// const adminEmails: string[] = [];
// for (const email of process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(',')) {
//   adminEmails.push(`${email.trim()}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN}`);
// }
// const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);

// export default clerkMiddleware(async (auth, request) => {
//   const { userId, redirectToSignIn } = await auth();

//   if (!userId) {
//     redirectToSignIn();
//     return;
//   }

//   const client = await clerkClient();
//   const user = await client.users.getUser(userId);
// 	if (!user || !user.primaryEmailAddress) {
// 		redirectToSignIn();
// 		return;
// 	}

// 	if (!user.primaryEmailAddress.emailAddress.endsWith(`@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN}`)) {
// 		await client.users.deleteUser(userId);
// 		redirectToSignIn();
// 		return;
// 	}

//   if (
//     isAdminRoute(request) &&
//     !adminEmails.includes(user.primaryEmailAddress.emailAddress)
//   ) {
//     // Using a fake permission results in a 404
//     // Permissions require orgs to be set up
//     await auth.protect({
//       permission: 'this:permission:does:not:exist',
//     });
//     return;
//   }

//   // Protect all routes by default
//   await auth.protect();
// });

export { auth as middleware } from '@/auth';

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
