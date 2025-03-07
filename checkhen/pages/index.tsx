import { useEffect, useState } from 'react';
import { User } from '@clerk/nextjs/server';
import { Class } from '@prisma/client';
import { Button } from '@mantine/core';
import { getSocket } from '@/lib/socket';
import { Socket } from 'socket.io-client';

export default function HomePage() {
  const [user, setUser] = useState<User>();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [currentClassId, setCurrentClassId] = useState(null);
  const [currentClassName, setCurrentClassName] = useState('');

  const fetchUser = async () => {
    const response = await fetch('/api/get-clerk-info');
    const data = await response.json();
    setUser(data.user);
  };

  const fetchCheckInStatus = async () => {
    const response = await fetch('/api/student/fetch-check-in');
    setCheckedIn(response.ok);
  };

  const fetchHandRaiseStatus = async () => {
    const response = await fetch('/api/student/fetch-hand-raise');
    setHandRaised(response.ok);
  };

  // const checkIn = async () => {
  //   const response = await fetch('/api/student/check-in', {
  //     method: 'POST',
  //   });

  //   if (response.ok) {
  //     setCheckedIn(true);
  //   }
  // };

  const toggleHandRaise = async () => {
    const response = await fetch('/api/student/toggle-vhr', {
      method: 'POST',
    });

    const data = await response.json();

    if (response.ok) {
      setHandRaised(data.status);
      socket?.emit("ping", "pong");
      socket?.emit('user-hand-update', {
        classId: data.classId,
        isRaised: data.status,
      });
    }
  };

  const fetchCurrentClass = async () => {
    const response = await fetch('/api/fetch-latest-class');
    if (!response.ok) {
      setCurrentClassName('');
      return;
    }
    const data = await response.json();
    const jsonData = JSON.parse(data.message);
    const date = new Date(jsonData.createdAt);
    const endDate = new Date(date.getTime() + jsonData.duration * 60000);

    if (endDate < new Date()) {
      setCurrentClassName('');
      return;
    }

    const formattedDate = date.toLocaleString();

    if (jsonData.id === currentClassId) {
      return;
    }

    setCurrentClassId(jsonData.id);
    setCurrentClassName(`${jsonData.name} - ${formattedDate}`);
  };

  useEffect(() => {
    fetchUser();
    fetchCurrentClass();
    fetchCheckInStatus();
    fetchHandRaiseStatus();

    const _interval = setInterval(() => {
      fetchCurrentClass();
      fetchCheckInStatus();
      // fetchHandRaiseStatus();
    }, 5000);
  }, []);

  useEffect(() => {
    console.log(user);
    if (!user || !currentClassId) return;

    const userId = user.id;
    const classId = currentClassId;
    const email = user.emailAddresses[0]?.emailAddress || '';

    console.log(email);

    const _socket = getSocket(userId, classId, email);
    setSocket(_socket);

    // socket?.on('check-raised-hands', () => {
    //   fetchHandRaiseStatus();
    // });

    socket?.onAny((event, ...args) => {
      switch (event) {
        case 'check-raised-hands':
          fetchHandRaiseStatus();
          break;
        default:
          console.log('Unknown event:', event);
      }
    });
  }, [user, currentClassId]);

  return (
    <>
      <div className="pr-19 grid grid-cols-1 gap-4">
        {currentClassName && (
          <>
            <div className="flex justify-center pt-2 gap-2">
              <h1 className="text-center text-xl font-bold underline flex-grow">
                Current Class Session
              </h1>
            </div>
            <div className="text-center">{currentClassName}</div>
          </>
        )}
        <div className="flex justify-center pt-2 gap-2">
          {/* <Button color="blue" disabled={!currentClassName || checkedIn} onClick={checkIn}>
            Check In
          </Button> */}
          <Button
            color={handRaised ? '#FFC20A' : '#0C7BDC'}
            disabled={!currentClassName}
            onClick={toggleHandRaise}
          >
            {handRaised ? 'Lower Hand' : 'Raise Hand'}
          </Button>
        </div>
      </div>
    </>
  );
}
