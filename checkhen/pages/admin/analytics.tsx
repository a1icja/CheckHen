import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Button,
  Card,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { BarChart, DonutChart } from '@mantine/charts';
import { ArrowLeft, GraduationCap } from 'lucide-react';

type StudentSummary = {
  email: string;
  anonymousName: string | null;
  checkInTime: string;
  checkOutTime: string | null;
  durationMinutes: number | null;
  handRaiseCount: number;
  paceSignal: string | null;
  engagementScore: number | null;
};

type AnalyticsData = {
  students: StudentSummary[];
  paceAggregate: { slow_down: number; ready_to_move_on: number };
  classes: { id: string; name: string; createdAt: string; duration: number }[];
  selectedClass: { id: string; name: string; createdAt: string; duration: number } | null;
};

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatPaceSignal(signal: string | null) {
  if (!signal) return '—';
  if (signal === 'slow_down') return 'Slow Down';
  if (signal === 'ready_to_move_on') return 'Ready';
  return signal;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const theme = useMantineTheme();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const fetchAnalytics = async (classId?: string) => {
    setLoading(true);
    const url = classId
      ? `/api/admin/fetch-analytics?classId=${classId}`
      : '/api/admin/fetch-analytics';
    const res = await fetch(url);
    if (res.status === 401 || res.status === 403) {
      router.push('/');
      return;
    }
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const json: AnalyticsData = await res.json();
    setData(json);
    if (json.selectedClass) setSelectedClassId(json.selectedClass.id);
    setLoading(false);
  };

  // Auth guard — redirect non-admins
  useEffect(() => {
    fetch('/api/auth/is-admin')
      .then((r) => r.json())
      .then(({ isAdmin }) => {
        if (!isAdmin) router.push('/');
        else fetchAnalytics();
      });
  }, []);

  const handleClassChange = (value: string | null) => {
    if (!value) return;
    setSelectedClassId(value);
    fetchAnalytics(value);
  };

  const classOptions =
    data?.classes.map((c) => ({
      value: c.id,
      label: `${c.name} — ${new Date(c.createdAt).toLocaleDateString()}`,
    })) ?? [];

  const durationChartData =
    data?.students.map((s) => ({
      name: s.anonymousName ?? s.email.split('@')[0],
      'Duration (min)': s.durationMinutes ?? 0,
    })) ?? [];

  const engagementChartData =
    data?.students
      .filter((s) => s.engagementScore !== null)
      .map((s) => ({
        name: s.anonymousName ?? s.email.split('@')[0],
        Score: s.engagementScore as number,
      })) ?? [];

  const donutData = data
    ? [
        { name: 'Slow Down', value: data.paceAggregate.slow_down, color: theme.colors.warning[5] },
        { name: 'Ready', value: data.paceAggregate.ready_to_move_on, color: theme.colors.successGreen[5] },
      ]
    : [];

  const totalPaceSignals = (data?.paceAggregate.slow_down ?? 0) + (data?.paceAggregate.ready_to_move_on ?? 0);

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
                Analytics
              </Text>
            </div>
          </Group>
          <Button
            variant="outline"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => router.push('/admin/dashboard')}
          >
            Back to Dashboard
          </Button>
        </Group>
      </Paper>

      <Box p="md" style={{ flex: 1 }}>
        {/* Session selector */}
        <Group mb="md" align="flex-end">
          <Select
            label="Session"
            placeholder="Select a session"
            data={classOptions}
            value={selectedClassId}
            onChange={handleClassChange}
            style={{ minWidth: 320 }}
          />
          {data?.selectedClass && (
            <Text size="sm" c="dimmed">
              {data.selectedClass.duration} min planned · {data.students.length} students
            </Text>
          )}
        </Group>

        {loading ? (
          <Stack align="center" mt="xl">
            <Loader />
            <Text c="dimmed">Loading analytics…</Text>
          </Stack>
        ) : !data || !data.selectedClass ? (
          <Card ta="center" mt="xl">
            <Text c="dimmed">No session data found.</Text>
          </Card>
        ) : (
          <Stack gap="lg">
            {/* Charts row */}
            <SimpleGrid cols={3} spacing="md">
              {/* Duration chart */}
              <Card>
                <Title order={5} mb="sm">Attendance Duration</Title>
                {durationChartData.length === 0 ? (
                  <Text c="dimmed" size="sm">No data</Text>
                ) : (
                  <BarChart
                    h={220}
                    data={durationChartData}
                    dataKey="name"
                    series={[{ name: 'Duration (min)', color: theme.colors.buBlue[5] }]}
                    tickLine="y"
                    withTooltip
                    withLegend={false}
                  />
                )}
              </Card>

              {/* Engagement score chart */}
              <Card>
                <Title order={5} mb="sm">Engagement Score</Title>
                {engagementChartData.length === 0 ? (
                  <Text c="dimmed" size="sm">No data — students must check out for scores to compute</Text>
                ) : (
                  <BarChart
                    h={220}
                    data={engagementChartData}
                    dataKey="name"
                    series={[{ name: 'Score', color: theme.colors.successGreen[5] }]}
                    tickLine="y"
                    withTooltip
                    withLegend={false}
                  />
                )}
              </Card>

              {/* Pace signals donut */}
              <Card>
                <Title order={5} mb="sm">Pace Signals</Title>
                {totalPaceSignals === 0 ? (
                  <Text c="dimmed" size="sm">No pace signals recorded</Text>
                ) : (
                  <Stack align="center" gap="xs">
                    <DonutChart
                      data={donutData}
                      size={160}
                      thickness={28}
                      withTooltip
                    />
                    <Group gap="md">
                      <Group gap={4}>
                        <Box w={12} h={12} style={{ borderRadius: 2, backgroundColor: theme.colors.warning[5] }} />
                        <Text size="xs">Slow Down: {data.paceAggregate.slow_down}</Text>
                      </Group>
                      <Group gap={4}>
                        <Box w={12} h={12} style={{ borderRadius: 2, backgroundColor: theme.colors.successGreen[5] }} />
                        <Text size="xs">Ready: {data.paceAggregate.ready_to_move_on}</Text>
                      </Group>
                    </Group>
                  </Stack>
                )}
              </Card>
            </SimpleGrid>

            {/* Detail table */}
            <Card p={0}>
              <Box p="md" pb="xs">
                <Title order={5}>Student Detail</Title>
              </Box>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Anonymous Name</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Check-In</Table.Th>
                    <Table.Th>Check-Out</Table.Th>
                    <Table.Th>Duration</Table.Th>
                    <Table.Th>Hand Raises</Table.Th>
                    <Table.Th>Pace Signal</Table.Th>
                    <Table.Th>Score</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.students.map((s) => {
                    const isShortSession =
                      s.durationMinutes !== null && s.durationMinutes < 10;
                    return (
                      <Table.Tr
                        key={s.email}
                        style={
                          isShortSession
                            ? { backgroundColor: theme.colors.buBlue[0] }
                            : undefined
                        }
                      >
                        <Table.Td>{s.anonymousName ?? '—'}</Table.Td>
                        <Table.Td>{s.email}</Table.Td>
                        <Table.Td>{formatTime(s.checkInTime)}</Table.Td>
                        <Table.Td>{formatTime(s.checkOutTime)}</Table.Td>
                        <Table.Td>
                          {s.durationMinutes !== null ? `${s.durationMinutes} min` : '—'}
                        </Table.Td>
                        <Table.Td>{s.handRaiseCount}</Table.Td>
                        <Table.Td>{formatPaceSignal(s.paceSignal)}</Table.Td>
                        <Table.Td>
                          {s.engagementScore !== null ? `${s.engagementScore} / 100` : '—'}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Card>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
