import { Box, Card, Group, SimpleGrid, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import { BarChart, DonutChart } from '@mantine/charts';
import { useMantineTheme } from '@mantine/core';
import { Info } from 'lucide-react';

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
  selectedClass: { id: string; name: string; createdAt: string; duration: number; color: string | null } | null;
  allTime?: boolean;
  sessionCount?: number;
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

type Props = {
  data: AnalyticsData;
  accentColor: string;
};

export function StudentDetailView({ data, accentColor }: Props) {
  const theme = useMantineTheme();

  const durationChartData = data.students.map((s) => ({
    name: s.anonymousName ?? s.email.split('@')[0],
    'Duration (min)': s.durationMinutes ?? 0,
  }));

  const engagementChartData = data.students
    .filter((s) => s.engagementScore !== null)
    .map((s) => ({
      name: s.anonymousName ?? s.email.split('@')[0],
      Score: s.engagementScore as number,
    }));

  const donutData = [
    { name: 'Slow Down', value: data.paceAggregate.slow_down, color: theme.colors.warning[5] },
    { name: 'Ready', value: data.paceAggregate.ready_to_move_on, color: theme.colors.successGreen[5] },
  ];
  const totalPaceSignals = data.paceAggregate.slow_down + data.paceAggregate.ready_to_move_on;

  return (
    <Stack gap="lg">
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
              <Table.Th>
                <Group gap={4} align="center" wrap="nowrap">
                  Score
                  <Tooltip
                    label={
                      <div>
                        <div>Score is out of 100:</div>
                        <div>• Up to 60pts for time attended</div>
                        <div>• Up to 30pts for hand raises (6pts each, max 5)</div>
                        <div>• 10pts for submitting a pace signal</div>
                      </div>
                    }
                    multiline
                    w={260}
                    withArrow
                  >
                    <Info size={14} style={{ cursor: 'pointer', opacity: 0.5 }} />
                  </Tooltip>
                </Group>
              </Table.Th>
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
  );
}
