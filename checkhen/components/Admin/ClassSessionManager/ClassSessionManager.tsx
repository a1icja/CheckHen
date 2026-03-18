import { useEffect, useState } from 'react';
import { Button, Group, Modal, Notification, NumberInput, SimpleGrid, Stack, Text, Title, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCheck, IconX } from '@tabler/icons-react';

export default function ClassSessionManager({
  currentClass,
  setCurrentClass,
  currentClassId,
  setCurrentClassId,
  onOpenModal,
}: {
  currentClass: string;
  setCurrentClass: (value: string) => void;
  currentClassId: string;
  setCurrentClassId: (value: string) => void;
  onOpenModal?: (openFn: () => void) => void;
}) {
  const [opened, { open, close }] = useDisclosure(false);

  // Expose the open function to the parent via callback
  useEffect(() => {
    if (onOpenModal) onOpenModal(open);
  }, [onOpenModal, open]);
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
      headers: { 'Content-Type': 'application/json' },
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
      displayNotification('Error ending class', true);
      return;
    }
    setCurrentClass('');
    setCurrentClassId('');
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
        <Stack gap={2} align="center" mb="xs">
          <Title order={5} td="underline">Current Class Session</Title>
          <Text size="sm" c="dimmed" ta="center">{currentClass}</Text>
        </Stack>
      )}
      <Modal opened={opened} onClose={close} title="Start New Class" centered>
        <Stack gap="sm">
          {notification && (
            <Notification
              icon={notificationIsError ? xIcon : checkIcon}
              color={notificationIsError ? 'red' : 'green'}
              title={notificationIsError ? 'Error' : 'Success'}
              withCloseButton={false}
              withBorder={false}
              style={{ boxShadow: 'none' }}
            >
              {notification}
            </Notification>
          )}
          <SimpleGrid cols={2} spacing="sm">
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
          </SimpleGrid>
          <Button onClick={() => createNewClass(modalClassName, Number(modalClassDuration))} color="successGreen">
            Start
          </Button>
        </Stack>
      </Modal>
      <Group justify="center" pt="sm" gap="sm">
        <Button onClick={open} color="successGreen" disabled={!!currentClass}>
          Start New Class
        </Button>
        <Button onClick={fetchCurrentClass} variant="light">Refresh</Button>
        <Button onClick={endClassEarly} disabled={!currentClass} color="red">End Class</Button>
      </Group>
    </>
  );
}
