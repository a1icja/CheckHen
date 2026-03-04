import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Socket } from 'socket.io-client';
import {
  Button,
  Card,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
  Box,
  Group,
  Badge,
  Flex,
  useMantineTheme,
  Alert,
  Divider,
} from '@mantine/core';
import {
  Hand,
  TrendingDown,
  CheckCircle,
  ArrowLeft,
  GraduationCap,
  Users,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
} from 'lucide-react';
import ClassSessionManager from '@/components/Admin/ClassSessionManager/ClassSessionManager';
import { getSocket } from '@/lib/socket';

type UserInfo = {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
};

type HandRaise = {
  id: string;
  name: string;
  email: string;
  raisedAt: string;
  isAcknowledged: boolean;
};

type ChatMessage = {
  id: string;
  message: string;
  anonymousName: string | null;
  createdAt: string;
  user: {
    email: string;
  };
};

type AttendanceRecord = {
  id: string;
  anonymousName: string | null;
  joinTime: string;
  user: {
    email: string;
  };
};

export default function AdminDashboard() {
  const router = useRouter();
  const theme = useMantineTheme();
  const ws = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State variables
  const [user, setUser] = useState<UserInfo>();
  const [currentClassId, setCurrentClassId] = useState<string>('');
  const [currentClass, setCurrentClass] = useState<string>('');
  const [handRaises, setHandRaises] = useState<HandRaise[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [paceSignals, setPaceSignals] = useState({ slowDown: 0, readyToMove: 0 });

  // Auto-scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch user info
  const fetchUser = async () => {
    const response = await fetch('/api/get-user-info');
    const data = await response.json();
    setUser(data.user);
  };

  // Fetch check-ins (attendance)
  const fetchCheckInsData = async () => {
    const response = await fetch('/api/admin/fetch-check-ins');
    if (!response.ok) return;

    const data = await response.json();
    const jsonData = JSON.parse(data.message);
    setAttendance(jsonData);
  };

  // Fetch hand raises
  const fetchHandRaiseData = async () => {
    const response = await fetch('/api/admin/fetch-hand-raise');
    if (!response.ok) {
      setHandRaises([]);
      return;
    }

    const data = await response.json();
    const jsonData = JSON.parse(data.message);

    // Transform the data to match our HandRaise type
    const transformedData = jsonData.map((item: any) => ({
      id: item.id || item.email,
      name: item.name,
      email: item.email,
      raisedAt: new Date().toISOString(), // You may want to add this field to the API response
      isAcknowledged: item.isAck || false,
    }));

    setHandRaises(transformedData);
  };

  // Acknowledge hand raise
  const ackHandRaise = async (email: string) => {
    const res = await fetch('/api/admin/ack-hand-raise', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      ws.current?.emit('user-hand-acked', { email, classId: currentClassId });
      fetchHandRaiseData();
    }
  };

  // Rate hand raise
  const rateHandRaise = async (email: string, good: boolean) => {
    const res = await fetch('/api/admin/rate-hand-raise', {
      method: 'POST',
      body: JSON.stringify({ email, good }),
    });

    if (res.ok) {
      ws.current?.emit('user-hand-acked', { email, classId: currentClassId });
      fetchHandRaiseData();
    }
  };

  // Fetch all chat messages
  const fetchAllChatMessages = async () => {
    const response = await fetch('/api/admin/fetch-all-chat');
    if (!response.ok) return;

    const data = await response.json();
    const jsonData = JSON.parse(data.message);
    setMessages(jsonData);
  };

  // Fetch last chat message
  const fetchLastChatMessage = async () => {
    const response = await fetch('/api/admin/fetch-last-chat');
    if (!response.ok) return;

    const data = await response.json();
    const jsonData = JSON.parse(data.message);
    const lastMessage = jsonData[0];

    setMessages((prevMessages) => {
      const newMessages = prevMessages.filter((message) => message.id !== lastMessage.id);
      return [...newMessages, lastMessage];
    });
  };

  // Fetch pace signals
  const fetchPaceSignals = async () => {
    const response = await fetch('/api/student/fetch-pace-signals');
    if (response.ok) {
      const data = await response.json();
      setPaceSignals({
        slowDown: data.slowDown || 0,
        readyToMove: data.readyToMove || 0,
      });
    }
  };

  // Reset pace signals
  const resetPaceSignals = async () => {
    const response = await fetch('/api/admin/reset-pace-signals', {
      method: 'POST',
    });

    if (response.ok) {
      setPaceSignals({ slowDown: 0, readyToMove: 0 });
      ws.current?.emit('pace-signals-reset', { classId: currentClassId });
    }
  };

  // Initial setup
  useEffect(() => {
    fetchUser();
    fetchCheckInsData();
    fetchHandRaiseData();
    fetchAllChatMessages();
    fetchPaceSignals();

    const _interval = setInterval(() => {
      fetchCheckInsData();
      fetchPaceSignals();
    }, 2500);

    return () => clearInterval(_interval);
  }, []);

  // WebSocket setup
  useEffect(() => {
    if (!user || !currentClassId) return;

    const classId = currentClassId;
    const email = user.emailAddresses[0]?.emailAddress || '';

    ws.current = getSocket(classId, email);

    ws.current?.on('user-hand-update', () => {
      fetchHandRaiseData();
    });

    ws.current?.on('fetch-messages', () => {
      fetchLastChatMessage();
    });

    ws.current?.on('pace-signal-update', () => {
      fetchPaceSignals();
    });

    return () => {
      ws.current?.off('user-hand-update');
      ws.current?.off('fetch-messages');
      ws.current?.off('pace-signal-update');
    };
  }, [user, currentClassId]);

  // Check if we should show pace alert (>30% want to slow down)
  const shouldShowPaceAlert =
    attendance.length > 0 && paceSignals.slowDown / attendance.length > 0.3;

  return (
    <Box style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper p="md" shadow="sm" withBorder style={{ borderRadius: 0 }}>
        <Group justify="space-between">
          <Group>
            <Box
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: theme.colors.buBlue[5],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GraduationCap size={20} color="white" />
            </Box>
            <div>
              <Title order={3}>CheckHen</Title>
              <Text size="sm" c="dimmed">
                Instructor View
              </Text>
            </div>
          </Group>
          <Button
            variant="outline"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => router.push('/')}
          >
            Student View
          </Button>
        </Group>
      </Paper>

      {/* Session Manager & Stats Bar */}
      <Paper p="md" shadow="xs" withBorder style={{ borderRadius: 0 }}>
        <Stack gap="md">
          <ClassSessionManager
            currentClass={currentClass}
            setCurrentClass={setCurrentClass}
            currentClassId={currentClassId}
            setCurrentClassId={setCurrentClassId}
          />

          {currentClass && (
            <>
              <Divider />
              <Group gap="xl">
                {/* Attendance */}
                <Group gap="xs">
                  <Users size={20} color={theme.colors.buBlue[5]} />
                  <div>
                    <Text size="xs" c="dimmed">
                      Attendance
                    </Text>
                    <Text size="lg" fw={700}>
                      {attendance.length} students
                    </Text>
                  </div>
                </Group>

                {/* Pace Signals */}
                <Group gap="md">
                  <Group gap="xs">
                    <TrendingDown size={20} color={theme.colors.warning[5]} />
                    <div>
                      <Text size="xs" c="dimmed">
                        Slow Down
                      </Text>
                      <Text size="lg" fw={700}>
                        {paceSignals.slowDown}
                      </Text>
                    </div>
                  </Group>

                  <Group gap="xs">
                    <CheckCircle size={20} color={theme.colors.successGreen[5]} />
                    <div>
                      <Text size="xs" c="dimmed">
                        Ready
                      </Text>
                      <Text size="lg" fw={700}>
                        {paceSignals.readyToMove}
                      </Text>
                    </div>
                  </Group>

                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<RefreshCw size={14} />}
                    onClick={resetPaceSignals}
                  >
                    Reset
                  </Button>
                </Group>

                {/* Alert if >30% want to slow down */}
                {shouldShowPaceAlert && (
                  <Alert icon={<AlertCircle size={16} />} color="warning" variant="light">
                    <Text size="sm" fw={600}>
                      Class pace concern
                    </Text>
                  </Alert>
                )}
              </Group>
            </>
          )}
        </Stack>
      </Paper>

      {/* Main Content - 3 Column Layout */}
      <Flex style={{ flex: 1, overflow: 'hidden' }}>
        {/* Left Column - Hand Raises */}
        <Box
          style={{
            width: 320,
            borderRight: `1px solid ${theme.colors.gray[3]}`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Paper p="md" shadow="xs" withBorder style={{ borderRadius: 0 }}>
            <Group gap="xs">
              <Hand size={20} color={theme.colors.warning[5]} />
              <Title order={4}>Hands Raised ({handRaises.length})</Title>
            </Group>
          </Paper>

          <ScrollArea style={{ flex: 1 }} p="md">
            <Stack gap="sm">
              {handRaises.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" mt="xl">
                  No raised hands
                </Text>
              ) : (
                handRaises.map((raise) => (
                  <Card key={raise.id} padding="sm">
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text size="sm" fw={600}>
                          {raise.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {new Date(raise.raisedAt).toLocaleTimeString()}
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {raise.email}
                      </Text>

                      <Group gap="xs" mt="xs">
                        {!raise.isAcknowledged ? (
                          <Button
                            size="xs"
                            variant="light"
                            fullWidth
                            onClick={() => ackHandRaise(raise.email)}
                          >
                            Acknowledge
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="xs"
                              variant="light"
                              color="successGreen"
                              style={{ flex: 1 }}
                              leftSection={<ThumbsUp size={14} />}
                              onClick={() => rateHandRaise(raise.email, true)}
                            >
                              Helpful
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color="warmRed"
                              style={{ flex: 1 }}
                              leftSection={<ThumbsDown size={14} />}
                              onClick={() => rateHandRaise(raise.email, false)}
                            >
                              Not Now
                            </Button>
                          </>
                        )}
                      </Group>
                    </Stack>
                  </Card>
                ))
              )}
            </Stack>
          </ScrollArea>
        </Box>

        {/* Center Column - De-anonymized Chat */}
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Paper p="md" shadow="xs" withBorder style={{ borderRadius: 0 }}>
            <Title order={4}>Class Discussion</Title>
            <Text size="sm" c="dimmed">
              De-anonymized view (real names shown)
            </Text>
          </Paper>

          <ScrollArea style={{ flex: 1 }} p="md">
            <Stack gap="sm">
              {messages.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" mt="xl">
                  No messages yet
                </Text>
              ) : (
                messages.map((msg) => (
                  <Paper key={msg.id} p="sm" radius="md" bg={theme.colors.gray[0]}>
                    <Group justify="space-between" mb={4}>
                      <Group gap="xs">
                        <Text size="sm" fw={600}>
                          {msg.user.email.split('@')[0]}
                        </Text>
                        <Badge size="xs" variant="light" color="gray">
                          as {msg.anonymousName || 'Anonymous'}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </Text>
                    </Group>
                    <Text size="sm">{msg.message}</Text>
                  </Paper>
                ))
              )}
              <div ref={messagesEndRef} />
            </Stack>
          </ScrollArea>
        </Box>

        {/* Right Column - Attendance List */}
        <Box
          style={{
            width: 320,
            borderLeft: `1px solid ${theme.colors.gray[3]}`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Paper p="md" shadow="xs" withBorder style={{ borderRadius: 0 }}>
            <Title order={4}>Present Students</Title>
          </Paper>

          <ScrollArea style={{ flex: 1 }} p="md">
            <Stack gap="xs">
              {attendance.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" mt="xl">
                  No students checked in
                </Text>
              ) : (
                attendance.map((record) => (
                  <Paper key={record.id} p="sm" radius="md" bg={theme.colors.gray[0]}>
                    <Text size="sm" fw={600}>
                      {record.user.email.split('@')[0]}
                    </Text>
                    <Group justify="space-between" mt={4}>
                      <Badge size="xs" variant="light">
                        {record.anonymousName || 'No name'}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {new Date(record.joinTime).toLocaleTimeString()}
                      </Text>
                    </Group>
                  </Paper>
                ))
              )}
            </Stack>
          </ScrollArea>
        </Box>
      </Flex>
    </Box>
  );
}
