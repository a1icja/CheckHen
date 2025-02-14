import { useEffect, useState } from 'react';
import ClassSessionManager from '@/components/Admin/ClassSessionManager/ClassSessionManager';
import { TableScrollArea } from '@/components/TableScrollArea/TableScrollArea';
import { SimpleUser } from '@/types';
import { Button } from '@mantine/core';

export default function Dashboard() {
  const [currentClass, setCurrentClass] = useState<string>('');
  const [checkedInUsers, setCheckedInUsers] = useState<Record<string, any>[]>([]);
  const [raisedHands, setRaisedHands] = useState<Record<string, any>[]>([]);

  const fetchCheckInsData = async () => {
    const response = await fetch('/api/admin/fetch-check-ins');
    const data = await response.json();
    const jsonData: SimpleUser[] = JSON.parse(data.message);

    const checkedInUsers = jsonData.map((user) => {
      return {
        id: user.name,
        email: user.email,
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

    fetchHandRaiseData();
  }

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

    fetchCheckInsData();
  };

  const ackVHRButton = (email: string, disabled: boolean) => {
    return <Button onClick={() => ackHandRaise(email)} disabled={disabled}>Acknowledge</Button>;
  };

  const rateVHRButton = (email: string) => {
    return (
      <div className='flex gap-4'>
        <Button onClick={() => rateHandRaise(email, true)} color="#4F7942">
          Good
        </Button>
        <Button onClick={() => rateHandRaise(email, false)} color="red">
          Bad
        </Button>
      </div>
    );
  };

  const fetchHandRaiseData = async () => {
    const response = await fetch('/api/admin/fetch-hand-raise');
    const data = await response.json();
    const jsonData: (SimpleUser & { isAck: boolean })[] = JSON.parse(data.message);

    const handStatus = jsonData.map((user) => {
      return {
        id: user.name,
        email: user.email,
        ackButton: ackVHRButton(user.email, user.isAck),
        rateButton: rateVHRButton(user.email),
      };
    });

    setRaisedHands(handStatus);
  };

  useEffect(() => {
    fetchCheckInsData();
    fetchHandRaiseData();

    const _interval = setInterval(() => {
      fetchCheckInsData();
      fetchHandRaiseData();
    }, 2500);
  }, []);

  return (
    <>
      <div className="pr-19 grid grid-cols-2 gap-4">
        <div>
          <ClassSessionManager currentClass={currentClass} setCurrentClass={setCurrentClass} />
        </div>
        <div>
          <h1>Checked In Students</h1>
          <TableScrollArea columns={['Name', 'Email']} data={checkedInUsers} />
        </div>
        <div className="pl-15">
          <h1>Raised Hands</h1>
          <TableScrollArea
            columns={['Name', 'Email', 'Acknowledge', 'Rate']}
            data={raisedHands}
          />
        </div>
      </div>
    </>
  );
}
