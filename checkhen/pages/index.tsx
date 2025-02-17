import { useEffect, useState } from 'react';
import { Button } from '@mantine/core';

export default function HomePage() {
  const [checkedIn, setCheckedIn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [currentClass, setCurrentClass] = useState('');

  const fetchCheckInStatus = async () => {
    const response = await fetch('/api/student/fetch-check-in');
    setCheckedIn(response.ok);
  };

  const fetchHandRaiseStatus = async () => {
    const response = await fetch('/api/student/fetch-hand-raise');
    setHandRaised(response.ok);
  };

  const checkIn = async () => {
    const response = await fetch('/api/student/check-in', {
      method: 'POST',
    });

    if (response.ok) {
      setCheckedIn(true);
    }
  }

  const toggleHandRaise = async () => {
    const response = await fetch('/api/student/toggle-vhr', {
      method: 'POST',
    });

    const data = await response.json();

    if (response.ok) {
      setHandRaised(data.status);
    }
  }

  const fetchCurrentClass = async () => {
    const response = await fetch('/api/admin/fetch-latest-class');
    if (!response.ok) {
      setCurrentClass('');
      return;
    }
    const data = await response.json();
    const jsonData = JSON.parse(data.message);
    const date = new Date(jsonData.createdAt);
    const endDate = new Date(date.getTime() + jsonData.duration * 60000);

    if (endDate < new Date()) {
      setCurrentClass('');
      return;
    }

    const formattedDate = date.toLocaleString();
    setCurrentClass(`${jsonData.name} - ${formattedDate}`);
  };

  useEffect(() => {
    fetchCurrentClass();
    fetchCheckInStatus();
    fetchHandRaiseStatus();

    const _interval = setInterval(() => {
      fetchCurrentClass();
      fetchCheckInStatus();
      fetchHandRaiseStatus();
    }, 5000);
  }, []);

  return (
    <>
      <div className="pr-19 grid grid-cols-1 gap-4">
        {currentClass && (
          <div className="flex justify-center pt-2 gap-2">
            <h1 className="text-center text-xl font-bold underline flex-grow">Current Class Session</h1>
            <div className="text-center">{currentClass}</div>
          </div>
        )}
        <div className="flex justify-center pt-2 gap-2">
          <Button color='blue' disabled={!currentClass || checkedIn} onClick={checkIn}>
            Check In
          </Button>
          <Button color={handRaised ? '#FFC20A' : '#0C7BDC'} disabled={!currentClass} onClick={toggleHandRaise}>{handRaised ? 'Lower Hand' : 'Raise Hand'}</Button>
        </div>
      </div>
    </>
  );
}
