import { useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import { Button } from '@mantine/core';

export default function AuthIcon({
  currentClass,
  setCurrentClass,
}: {
  currentClass: string;
  setCurrentClass: (value: string) => void;
}) {
  const fetchCurrentClass = async () => {
    const response = await fetch('/api/admin/fetch-latest-class');
    if (!response.ok) {
      setCurrentClass('No class found');
      return;
    }
    const data = await response.json();
    const date = new Date(JSON.parse(data.message).createdAt);
    const formattedDate = date.toLocaleString();
    setCurrentClass(formattedDate);
  };

  const createNewClass = async () => {
    const response = await fetch('/api/admin/start-new-class', {
      method: 'POST',
    });
    if (!response.ok) {
      setCurrentClass('Error starting new class');
      return;
    }
    const data = await response.json();
    const date = new Date(JSON.parse(data.message).createdAt);
    const formattedDate = date.toLocaleString();
    setCurrentClass(formattedDate);
  };

  useEffect(() => {
    fetchCurrentClass();
  }, []);

  return (
    <>
      <h1 className="text-center text-xl font-bold underline">Current Class Session</h1>
      <div className="text-center">{currentClass}</div>
      <div className="flex justify-center pt-2 gap-2">
        <Button onClick={createNewClass} color="#4F7942">
          Start New Class
        </Button>
        <Button onClick={fetchCurrentClass}>Refresh</Button>
      </div>
    </>
  );
}
