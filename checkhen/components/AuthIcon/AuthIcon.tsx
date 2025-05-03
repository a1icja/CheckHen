import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function AuthIcon() {
  return (
    <div className="flex items-center p-4">
      <div className="grow"></div>
      <div className="flex-shrink bg-black pb-0 p-2 rounded-full">
        <SignedOut>
          <SignInButton />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </div>
  );
}
