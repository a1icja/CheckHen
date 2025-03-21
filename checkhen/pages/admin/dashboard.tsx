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

  const [user, setUser] = useState<User>();
  const [currentClassId, setCurrentClassId] = useState<string>('');
  const [currentClass, setCurrentClass] = useState<string>('');
  const [checkedInUsers, setCheckedInUsers] = useState<Record<string, any>[]>([]);
  const [raisedHands, setRaisedHands] = useState<Record<string, any>[]>([]);
  
  const fetchUser = async () => {
    const response = await fetch('/api/get-clerk-info');
    const data = await response.json();
    setUser(data.user);
  };

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
        handRaises: user.handRaiseCount,
      };
    });

    setCheckedInUsers(checkedInUsers);
  };

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

  // TODO: implement api endpoint
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
        Acknowledge
      </Button>
    );
  };

  const rateVHRButton = (email: string) => {
    return (
      <div className="flex gap-4">
        <Button onClick={() => rateHandRaise(email, true)} color="black">
          ✅
        </Button>
        <Button onClick={() => rateHandRaise(email, false)} color="black">
          ❌
        </Button>
      </div>
    );
  };

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
        email: user.email,
        ackButton: ackVHRButton(user.email, user.isAck),
        handRaises: user.handRaiseCount,
        rateButton: rateVHRButton(user.email),
      };
    });

    setRaisedHands(handStatus);
  };

  useEffect(() => {
    fetchUser();
    fetchCheckInsData();
    fetchHandRaiseData();

    const _interval = setInterval(() => {
      fetchCheckInsData();
    }, 2500);
  }, []);

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
      <div className="pr-19 grid grid-cols-2 gap-4">
        <div>
          <ClassSessionManager
            currentClass={currentClass}
            setCurrentClass={setCurrentClass}
            currentClassId={currentClassId}
            setCurrentClassId={setCurrentClassId}
          />
        </div>
        <div>
          <h1>Checked In Students</h1>
          <TableScrollArea columns={['Name', 'Email', 'Hand Raises']} data={checkedInUsers} />
        </div>
        <div className="pl-15">
          <h1>Raised Hands</h1>
          <TableScrollArea
            columns={['Name', 'Email', 'Acknowledge', 'Hand Raises', 'Rate']}
            data={raisedHands}
          />
        </div>
      </div>
    </>
  );
}
