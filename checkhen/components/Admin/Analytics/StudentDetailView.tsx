import { Box, Card, Group, SimpleGrid, Stack, Table, Text, Title, Tooltip, UnstyledButton } from '@mantine/core';
import { BarChart, DonutChart } from '@mantine/charts';
import { useMantineTheme } from '@mantine/core';
import { useState } from 'react';
import { Info, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

function TooltipCard({ label, rows }: { label: string; rows: { color: string; name: string; value: string }[] }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #dee2e6',
      borderRadius: 6,
      padding: '8px 12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      minWidth: 140,
      pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#212529' }}>{label}</div>
      {rows.map((row) => (
        <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#495057' }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: row.color, flexShrink: 0 }} />
          <span>{row.name}:</span>
          <span style={{ fontWeight: 600, color: '#212529' }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

type StudentSummary = {
  email: string;
  displayName: string | null;
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
  attendanceWeight?: number;
  handRaiseWeight?: number;
  totalPlannedMinutes?: number;
};

type SortKey = 'name' | 'duration' | 'handRaises' | 'score';
type SortDir = 'asc' | 'desc';

function recomputeScore(
  s: StudentSummary,
  attendanceWeight: number,
  handRaiseWeight: number,
  totalPlannedMinutes: number,
): number | null {
  if (s.durationMinutes === null) return null;
  const attendanceScore = Math.min(s.durationMinutes / totalPlannedMinutes, 1) * attendanceWeight;
  const handScore = Math.min(s.handRaiseCount, 5) * (handRaiseWeight / 5);
  return Math.round(attendanceScore + handScore);
}

export function StudentDetailView({ data, accentColor, attendanceWeight, handRaiseWeight, totalPlannedMinutes }: Props) {
  const theme = useMantineTheme();
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const useCustomWeights = data.allTime && attendanceWeight !== undefined && handRaiseWeight !== undefined && totalPlannedMinutes !== undefined;
  const students = useCustomWeights
    ? data.students.map((s) => ({
        ...s,
        engagementScore: recomputeScore(s, attendanceWeight!, handRaiseWeight!, totalPlannedMinutes!),
      }))
    : data.students;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }

  function SortHeader({ col, label, children }: { col: SortKey; label?: React.ReactNode; children?: React.ReactNode }) {
    const active = sortKey === col;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <UnstyledButton
        onClick={() => handleSort(col)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 'inherit', whiteSpace: 'nowrap' }}
      >
        {label ?? children}
        <Icon size={13} style={{ opacity: active ? 1 : 0.35, flexShrink: 0 }} />
      </UnstyledButton>
    );
  }

  const studentLabel = (s: StudentSummary) =>
    s.displayName || s.email.split('@')[0];

  const durationChartData = students.map((s, i) => ({
    index: i + 1,
    name: studentLabel(s),
    'Duration (min)': s.durationMinutes ?? 0,
  }));

  const engagementChartData = students
    .filter((s) => s.engagementScore !== null)
    .map((s, i) => ({
      index: i + 1,
      name: studentLabel(s),
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
              dataKey="index"
              series={[{ name: 'Duration (min)', color: accentColor }]}
              tickLine="y"
              withTooltip
              tooltipAnimationDuration={0}
              withLegend={false}
              xAxisProps={{ tick: false, height: 8 }}
              yAxisProps={{ tick: { fontSize: 13 } }}
              tooltipProps={{
                wrapperStyle: { zIndex: 10, outline: 'none' },
                content: ({ payload }) => {
                  if (!payload?.length) return null;
                  const point = payload[0].payload;
                  return (
                    <TooltipCard
                      label={point.name}
                      rows={[{ color: accentColor, name: 'Duration', value: `${point['Duration (min)']} min` }]}
                    />
                  );
                },
              }}
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
              dataKey="index"
              series={[{ name: 'Score', color: theme.colors.successGreen[5] }]}
              tickLine="y"
              withTooltip
              tooltipAnimationDuration={0}
              withLegend={false}
              xAxisProps={{ tick: false, height: 8 }}
              yAxisProps={{ tick: { fontSize: 13 } }}
              tooltipProps={{
                wrapperStyle: { zIndex: 10, outline: 'none' },
                content: ({ payload }) => {
                  if (!payload?.length) return null;
                  const point = payload[0].payload;
                  return (
                    <TooltipCard
                      label={point.name}
                      rows={[{ color: theme.colors.successGreen[5], name: 'Score', value: `${point['Score']} / 100` }]}
                    />
                  );
                },
              }}
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
              <Table.Th><SortHeader col="name" label="Preferred Name" /></Table.Th>
              {!data.allTime && <Table.Th>Anonymous Name</Table.Th>}
              <Table.Th>Email</Table.Th>
              {!data.allTime && <Table.Th>Check-In</Table.Th>}
              {!data.allTime && <Table.Th>Check-Out</Table.Th>}
              <Table.Th><SortHeader col="duration" label={data.allTime ? 'Total Duration' : 'Duration'} /></Table.Th>
              <Table.Th><SortHeader col="handRaises" label="Hand Raises" /></Table.Th>
              {!data.allTime && <Table.Th>Pace Signal</Table.Th>}
              <Table.Th>
                <Group gap={4} align="center" wrap="nowrap">
                  <SortHeader col="score" label="Score" />
                  <Tooltip
                    label={
                      useCustomWeights ? (
                        <Stack gap={2}>
                          <Text size="xs" fw={600}>Score is out of 100:</Text>
                          <Text size="xs">• Up to {attendanceWeight}pts for time attended</Text>
                          <Text size="xs">• Up to {handRaiseWeight}pts for hand raises (max 5)</Text>
                        </Stack>
                      ) : (
                        <Stack gap={2}>
                          <Text size="xs" fw={600}>Score is out of 100:</Text>
                          <Text size="xs">• Up to 60pts for time attended</Text>
                          <Text size="xs">• Up to 30pts for hand raises (6pts each, max 5)</Text>
                          <Text size="xs">• 10pts for submitting a pace signal</Text>
                        </Stack>
                      )
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
            {[...students]
              .sort((a, b) => {
                let cmp = 0;
                if (sortKey === 'name') {
                  const na = (a.displayName || a.email.split('@')[0]).toLowerCase();
                  const nb = (b.displayName || b.email.split('@')[0]).toLowerCase();
                  cmp = na.localeCompare(nb);
                } else if (sortKey === 'duration') {
                  cmp = (a.durationMinutes ?? -1) - (b.durationMinutes ?? -1);
                } else if (sortKey === 'handRaises') {
                  cmp = a.handRaiseCount - b.handRaiseCount;
                } else if (sortKey === 'score') {
                  cmp = (a.engagementScore ?? -1) - (b.engagementScore ?? -1);
                }
                return sortDir === 'asc' ? cmp : -cmp;
              })
              .map((s) => {
                const isShortSession =
                  !data.allTime && s.durationMinutes !== null && s.durationMinutes < 10;
                return (
                  <Table.Tr
                    key={s.email}
                    style={isShortSession ? { backgroundColor: theme.colors.buBlue[0] } : undefined}
                  >
                    <Table.Td>{s.displayName || s.email.split('@')[0]}</Table.Td>
                    {!data.allTime && <Table.Td>{s.anonymousName ?? '—'}</Table.Td>}
                    <Table.Td>{s.email}</Table.Td>
                    {!data.allTime && <Table.Td>{formatTime(s.checkInTime)}</Table.Td>}
                    {!data.allTime && <Table.Td>{formatTime(s.checkOutTime)}</Table.Td>}
                    <Table.Td>
                      {s.durationMinutes !== null ? `${s.durationMinutes} min` : '—'}
                    </Table.Td>
                    <Table.Td>{s.handRaiseCount}</Table.Td>
                    {!data.allTime && <Table.Td>{formatPaceSignal(s.paceSignal)}</Table.Td>}
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
