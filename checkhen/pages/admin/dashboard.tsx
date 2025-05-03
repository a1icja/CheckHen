import { useEffect, useRef, useState } from 'react';
import { User } from '@clerk/nextjs/server';
import { Button } from '@mantine/core';
import ClassSessionManager from '@/components/Admin/ClassSessionManager/ClassSessionManager';
import { TableScrollArea } from '@/components/TableScrollArea/TableScrollArea';
import { SimpleUser } from '@/types';
import { getSocket } from '@/lib/socket';
import { Socket } from 'socket.io-client';

export default function Dashboard() {
  const ws = useRef<Socket | null>(null);

  // State variables for user, current class, checked-in users, and raised hands
  const [user, setUser] = useState<User>();
  const [currentClassId, setCurrentClassId] = useState<string>('');
  const [currentClass, setCurrentClass] = useState<string>('');
  const [checkedInUsers, setCheckedInUsers] = useState<Record<string, any>[]>([]);
  const [raisedHands, setRaisedHands] = useState<Record<string, any>[]>([]);
  
  // Fetches the current user's information from the backend
  const fetchUser = async () => {
    const response = await fetch('/api/get-clerk-info');
    const data = await response.json();
    setUser(data.user);
  };

  // Fetches the list of checked-in users
  const fetchCheckInsData = async () => {
    const response = await fetch('/api/admin/fetch-check-ins');
    const data = await response.json();

    if (!response.ok) {
      return;
    }

    const jsonData: SimpleUser[] = JSON.parse(data.message);

    const checkedInUsers = jsonData.map((user) => {
      return {
        id: user.name,
        email: user.email,
      };
    });

    setCheckedInUsers(checkedInUsers);
  };

  // Acknowledges a hand raise request
  const ackHandRaise = async (email: string) => {
    const res = await fetch('/api/admin/ack-hand-raise', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      console.error('Error acknowledging hand raise');
      return;
    }

    ws.current?.emit('user-hand-acked', { email, classId: currentClassId });

    fetchHandRaiseData();
  };

  // Rates a hand raise request as productive or not
  const rateHandRaise = async (email: string, good: boolean) => {
    const res = await fetch('/api/admin/rate-hand-raise', {
      method: 'POST',
      body: JSON.stringify({ email, good }),
    });

    if (!res.ok) {
      console.error('Error rating hand raise');
      return;
    }

    ws.current?.emit('user-hand-acked', { email, classId: currentClassId });

    fetchHandRaiseData();
  };

  const ackVHRButton = (email: string, disabled: boolean) => {
    return (
      <Button onClick={() => ackHandRaise(email)} disabled={disabled}>
        ✅
      </Button>
    );
  };

  const rateVHRButton = (email: string) => {
    return (
      <div className="flex gap-4">
        <Button onClick={() => rateHandRaise(email, true)} color="black">
          👍
        </Button>
        <Button onClick={() => rateHandRaise(email, false)} color="black">
          👎
        </Button>
      </div>
    );
  };

  // Fetches the list of raised hands
  const fetchHandRaiseData = async () => {
    const response = await fetch('/api/admin/fetch-hand-raise');
    const data = await response.json();

    if (!response.ok) {
      return;
    }

    const jsonData: (SimpleUser & { isAck: boolean })[] = JSON.parse(data.message);

    const handStatus = jsonData.map((user) => {
      return {
        id: user.name,
        handRaises: `${user.handRaiseCount} / ${user.overallHandRaiseCount}`,
        actions: (
          <div className="flex gap-4">
            {!user.isAck && ackVHRButton(user.email, user.isAck)}
            {user.isAck && rateVHRButton(user.email)}
          </div>
        ),
      }
    });

    setRaisedHands(handStatus);
  };

  // Initial setup: fetch user, checked-in users, and raised hands
  useEffect(() => {
    fetchUser();
    fetchCheckInsData();
    fetchHandRaiseData();

    const _interval = setInterval(() => {
      fetchCheckInsData();
    }, 2500);
  }, []);

  // Set up WebSocket connection when user and class ID are available
  useEffect(() => {
    if (!user || !currentClassId) return;

    const userId = user.id;
    const classId = currentClassId;
    const email = user.emailAddresses[0]?.emailAddress || '';

    ws.current = getSocket(userId, classId, email);
    
    ws.current?.on('user-hand-update', () => {
      fetchHandRaiseData();
    });
  }, [user, currentClassId]);

  return (
    <>
      <div className="pl-2 pr-2 lg:pl-15 lg:pr-19 grid grid-cols-1 gap-4">
        <div>
          <ClassSessionManager
            currentClass={currentClass}
            setCurrentClass={setCurrentClass}
            currentClassId={currentClassId}
            setCurrentClassId={setCurrentClassId}
          />
        </div>
        <div>
          <h1>Raised Hands</h1>
          <TableScrollArea
            columns={['Name', 'Hand Raises', 'Actions']}
            data={raisedHands}
          />
        </div>
        <div>
          <h1>Checked In Students</h1>
          <TableScrollArea columns={['Name', 'Email']} data={checkedInUsers} />
        </div>
      </div>
    </>
  );
}
