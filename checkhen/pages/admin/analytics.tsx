import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
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

type TemplateOption = {
  id: string;
  name: string;
  color: string;
};

type AnalyticsData = {
  students: StudentSummary[];
  paceAggregate: { slow_down: number; ready_to_move_on: number };
  classes: { id: string; name: string; createdAt: string; duration: number; color: string | null }[];
  selectedClass: { id: string; name: string; createdAt: string; duration: number; color: string | null } | null;
  allTime?: boolean;
  template?: TemplateOption | null;
  sessionCount?: number;
  templates?: TemplateOption[];
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

// Encode selection as a string for the <Select> value
const ALL_TIME_PREFIX = 'alltime:';

export default function AnalyticsPage() {
  const router = useRouter();
  const theme = useMantineTheme();
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.isAdmin === true;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [selectValue, setSelectValue] = useState<string | null>(null);

  const fetchAnalytics = async (value?: string | null) => {
    setLoading(true);
    let url: string;
    if (value?.startsWith(ALL_TIME_PREFIX)) {
      const templateId = value.slice(ALL_TIME_PREFIX.length);
      url = `/api/admin/fetch-analytics?templateId=${templateId}&allTime=true`;
    } else if (value) {
      url = `/api/admin/fetch-analytics?classId=${value}`;
    } else {
      url = '/api/admin/fetch-analytics';
    }

    const res = await fetch(url);
    if (res.status === 401 || res.status === 403) {
      router.push('/');
      return;
    }
    if (!res.ok) { setLoading(false); return; }

    const json: AnalyticsData = await res.json();
    setData(json);

    // Sync select value
    if (!value) {
      if (json.selectedClass) setSelectValue(json.selectedClass.id);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (status === 'loading') return;
    if (!isAdmin) { router.push('/'); return; }
    fetchAnalytics();
  }, [status, isAdmin]);

  const handleSelectChange = (value: string | null) => {
    if (!value) return;
    setSelectValue(value);
    fetchAnalytics(value);
  };

  // Mantine Select grouped format: { group: string, items: ComboboxItem[] }
  // Passing flat items with a 'group' key causes it to look for item.items.map() → crash
  const allTimeItems =
    data?.templates?.map((t) => ({
      value: `${ALL_TIME_PREFIX}${t.id}`,
      label: `All Sessions — ${t.name}`,
    })) ?? [];

  const sessionItems =
    data?.classes?.map((c) => ({
      value: c.id,
      label: `${c.name} — ${new Date(c.createdAt).toLocaleDateString()}`,
    })) ?? [];

  const classOptions = [
    ...(allTimeItems.length > 0 ? [{ group: 'Aggregated (All Sessions)', items: allTimeItems }] : []),
    ...(sessionItems.length > 0 ? [{ group: 'Individual Sessions', items: sessionItems }] : []),
  ];

  // Determine accent color for the current view
  const accentColor =
    data?.allTime
      ? (data.template?.color ?? theme.colors.buBlue[5])
      : (data?.selectedClass?.color ?? theme.colors.buBlue[5]);

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

  const totalPaceSignals =
    (data?.paceAggregate.slow_down ?? 0) + (data?.paceAggregate.ready_to_move_on ?? 0);

  const statsLabel = data?.allTime
    ? `${data.sessionCount} session${data.sessionCount !== 1 ? 's' : ''} · ${data.students.length} students total`
    : data?.selectedClass
    ? `${data.selectedClass.duration} min planned · ${data.students.length} students`
    : null;

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper
        p="md"
        shadow="sm"
        withBorder
        style={{
          borderRadius: 0,
          borderLeft: `4px solid ${accentColor}`,
        }}
      >
        <Group justify="space-between">
          <Group>
            <Box
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GraduationCap size={20} color="white" />
            </Box>
            <div>
              <Title order={3}>CheckHen</Title>
              <Text size="sm" c="dimmed">Analytics</Text>
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
            value={selectValue}
            onChange={handleSelectChange}
            style={{ minWidth: 360 }}
          />
          {statsLabel && (
            <Text size="sm" c="dimmed">{statsLabel}</Text>
          )}
        </Group>

        {loading ? (
          <Stack align="center" mt="xl">
            <Loader />
            <Text c="dimmed">Loading analytics…</Text>
          </Stack>
        ) : !data || (!data.selectedClass && !data.allTime) ? (
          <Card ta="center" mt="xl">
            <Text c="dimmed">No session data found.</Text>
          </Card>
        ) : (
          <Stack gap="lg">
            {/* Charts row */}
            <SimpleGrid cols={3} spacing="md">
              {/* Duration chart */}
              <Card>
                <Title order={5} mb="sm">
                  {data.allTime ? 'Total Attendance (min)' : 'Attendance Duration'}
                </Title>
                {durationChartData.length === 0 ? (
                  <Text c="dimmed" size="sm">No data</Text>
                ) : (
                  <BarChart
                    h={220}
                    data={durationChartData}
                    dataKey="name"
                    series={[{ name: 'Duration (min)', color: accentColor }]}
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
                    <DonutChart data={donutData} size={160} thickness={28} withTooltip />
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
                {data.allTime && (
                  <Text size="xs" c="dimmed">
                    Duration and hand raises are totals across all {data.sessionCount} sessions.
                  </Text>
                )}
              </Box>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Anonymous Name</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>{data.allTime ? 'First Check-In' : 'Check-In'}</Table.Th>
                    <Table.Th>{data.allTime ? 'Last Check-Out' : 'Check-Out'}</Table.Th>
                    <Table.Th>{data.allTime ? 'Total Duration' : 'Duration'}</Table.Th>
                    <Table.Th>Hand Raises</Table.Th>
                    <Table.Th>Pace Signal</Table.Th>
                    <Table.Th>Score</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.students.map((s) => {
                    const isShortSession =
                      !data.allTime && s.durationMinutes !== null && s.durationMinutes < 10;
                    return (
                      <Table.Tr
                        key={s.email}
                        style={isShortSession ? { backgroundColor: theme.colors.buBlue[0] } : undefined}
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
