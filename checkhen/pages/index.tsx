import { useEffect, useState } from 'react';
import { Button } from '@mantine/core';

export default function HomePage() {
  const [checkedIn, setCheckedIn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

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

  useEffect(() => {
    fetchCheckInStatus();
    fetchHandRaiseStatus();

    const _interval = setInterval(() => {
      fetchHandRaiseStatus();
    }, 5000);
  }, []);

  return (
    <>
      <div className="pr-19 grid grid-cols-3 gap-4">
        <div className="flex justify-center pt-2 gap-2">
          <Button color='blue' disabled={checkedIn} onClick={checkIn}>
            Check In
          </Button>
          <Button color={handRaised ? '#4F7942' : 'red'} onClick={toggleHandRaise}>Raise Hand</Button>
        </div>
      </div>
    </>
  );
}
