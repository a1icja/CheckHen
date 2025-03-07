import { useEffect, useState } from 'react';
import { Button, Modal, Notification, NumberInput, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCheck, IconX } from '@tabler/icons-react';

export default function ClassSessionManager({
  currentClass,
  setCurrentClass,
  currentClassId,
  setCurrentClassId,
}: {
  currentClass: string;
  setCurrentClass: (value: string) => void;
  currentClassId: string;
  setCurrentClassId: (value: string) => void;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const [modalClassName, setModalClassName] = useState<string>('');
  const [modalClassDuration, setModalClassDuration] = useState<string | number>('');
  const [notification, setNotification] = useState<string>('');
  const [notificationIsError, setNotificationIsError] = useState<boolean>(false);

  const xIcon = <IconX size={20} />;
  const checkIcon = <IconCheck size={20} />;

  const fetchCurrentClass = async () => {
    const response = await fetch('/api/fetch-latest-class');
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

    if (currentClassId === jsonData.id) return;

    setCurrentClassId(jsonData.id);
    const formattedDate = date.toLocaleString();
    setCurrentClass(`${jsonData.name} - ${formattedDate}`);
  };

  const createNewClass = async (name: string, duration: number) => {
    if (!name) {
      setCurrentClass('Please enter a class name');
      return;
    }

    if (duration <= 0) {
      // setCurrentClass('Please enter a valid class duration');
      displayNotification('Please enter a valid class duration', true);
      return;
    }

    const response = await fetch('/api/admin/start-new-class', {
      method: 'POST',
      body: JSON.stringify({ name, duration }),
    });
    if (!response.ok) {
      setCurrentClass('Error starting new class');
      return;
    }
    const data = await response.json();
    const jsonData = JSON.parse(data.message);
    const date = new Date(jsonData.createdAt);
    const formattedDate = date.toLocaleString();
    setCurrentClass(`${jsonData.name} - ${formattedDate}`);
    displayNotification('', false); // clear notification
    setModalClassName(''); // clear input
    setModalClassDuration(''); // clear input
    close();
  };

  const displayNotification = (message: string, isError: boolean = false) => {
    setNotificationIsError(isError);
    setNotification(message);
  };

  const endClassEarly = async () => {
    const response = await fetch('/api/admin/end-class-early', {
      method: 'POST',
    });
    if (!response.ok) {
      setCurrentClass('Error ending class');
      return;
    }
  }

  useEffect(() => {
    fetchCurrentClass();

    const interval = setInterval(() => {
      fetchCurrentClass();
    }, 60 * 1000);
  }, []);

  return (
    <>
      {currentClass && (
        <div>
          <h1 className="text-center text-xl font-bold underline">Current Class Session</h1>
          <div className="text-center">{currentClass}</div>
        </div>
      )}
      <Modal opened={opened} onClose={close} title="Start New Class" centered>
        {notification && (
          <Notification
            className='justify-self-right !shadow-none'
            icon={notificationIsError ? xIcon : checkIcon}
            color={notificationIsError ? 'red' : 'green'}
            title={notificationIsError ? 'Error' : 'Success'}
            withCloseButton={false}
            withBorder={false}
          >
            {notification}
          </Notification>
        )}
        <div className='grid grid-cols-2 gap-2'>
          <TextInput
            placeholder="Class Name"
            value={modalClassName}
            onChange={e => setModalClassName(e.currentTarget.value)}
          />
          <NumberInput
            placeholder="Duration (minutes)"
            value={modalClassDuration}
            onChange={setModalClassDuration}
          />
          <Button onClick={() => createNewClass(modalClassName, Number(modalClassDuration))} color="#4F7942">
            Start
          </Button>
        </div>
      </Modal>
      <div className="flex justify-center pt-2 gap-2">
        <Button onClick={open} color="#4F7942" disabled={!!currentClass}>
          Start New Class
        </Button>
        <Button onClick={fetchCurrentClass}>Refresh</Button>
        <Button onClick={endClassEarly} disabled={!currentClass} color='red'>End Class</Button>
      </div>
    </>
  );
}
