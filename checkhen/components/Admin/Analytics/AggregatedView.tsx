import { Alert, Badge, Card, Group, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { Info } from 'lucide-react';

type PaceTimelineBucket = {
  minutesBucket: number;
  slowDown: number;
  readyToMove: number;
};

type LeaveEvent = {
  displayName: string | null;
  anonymousName: string | null;
  checkInTime: string;
  checkOutTime: string | null;
  durationMinutes: number | null;
  leftEarly: boolean;
};

type AggregatedStats = {
  totalStudents: number;
  avgDurationMinutes: number;
  absentMoreThan50Percent: number;
  avgMessagesPerStudent: number;
  avgHandRaisesPerStudent: number;
  paceSignalTimeline: PaceTimelineBucket[];
  leaveEvents: LeaveEvent[];
};

type Props = {
  aggregated: AggregatedStats;
  classDuration: number;
};

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card withBorder>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>{label}</Text>
      <Title order={2}>{value}</Title>
      {sub && <Text size="xs" c="dimmed" mt={2}>{sub}</Text>}
    </Card>
  );
}

export function AggregatedView({ aggregated, classDuration }: Props) {
  const earlyLeaves = aggregated.leaveEvents.filter((e) => e.leftEarly);
  const stillPresent = aggregated.leaveEvents.filter((e) => e.checkOutTime === null);

  return (
    <Stack gap="lg">
      {/* Stat cards */}
      <SimpleGrid cols={5} spacing="md">
        <StatCard
          label="Students"
          value={aggregated.totalStudents}
        />
        <StatCard
          label="Avg Time in Class"
          value={`${aggregated.avgDurationMinutes} min`}
          sub={`of ${classDuration} min planned`}
        />
        <StatCard
          label="Left Before 50%"
          value={aggregated.absentMoreThan50Percent}
          sub={aggregated.totalStudents > 0
            ? `${Math.round((aggregated.absentMoreThan50Percent / aggregated.totalStudents) * 100)}% of class`
            : undefined}
        />
        <StatCard
          label="Avg Messages"
          value={aggregated.avgMessagesPerStudent}
          sub="per student"
        />
        <StatCard
          label="Avg Hand Raises"
          value={aggregated.avgHandRaisesPerStudent}
          sub="per student"
        />
      </SimpleGrid>

      {/* Leave / checkout events */}
      <Card p={0}>
        <Stack gap={0}>
          <Group p="md" pb="xs" justify="space-between" align="flex-start">
            <div>
              <Title order={5}>Attendance Events</Title>
              <Text size="xs" c="dimmed">
                {earlyLeaves.length} left early · {stillPresent.length} still present
              </Text>
            </div>
          </Group>

          <Alert
            mx="md"
            mb="md"
            variant="light"
            color="blue"
            icon={<Info size={16} />}
          >
            Check-in time reflects the student&apos;s most recent entry. If a student left and rejoined, their latest check-in time is shown.
          </Alert>

          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Preferred Name</Table.Th>
                <Table.Th>Anonymous Name</Table.Th>
                <Table.Th>Check-In</Table.Th>
                <Table.Th>Check-Out</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {aggregated.leaveEvents.map((e, i) => {
                let statusBadge;
                if (e.checkOutTime === null) {
                  statusBadge = <Badge color="blue" variant="light" size="sm">Still Present</Badge>;
                } else if (e.durationMinutes !== null && e.durationMinutes < classDuration * 0.5) {
                  statusBadge = <Badge color="red" variant="light" size="sm">Left {'<'}50%</Badge>;
                } else if (e.leftEarly) {
                  statusBadge = <Badge color="orange" variant="light" size="sm">Left Early</Badge>;
                } else {
                  statusBadge = <Badge color="green" variant="light" size="sm">Stayed</Badge>;
                }

                return (
                  <Table.Tr key={i}>
                    <Table.Td>{e.displayName || e.anonymousName || '—'}</Table.Td>
                    <Table.Td>{e.anonymousName ?? '—'}</Table.Td>
                    <Table.Td>{formatTime(e.checkInTime)}</Table.Td>
                    <Table.Td>{formatTime(e.checkOutTime)}</Table.Td>
                    <Table.Td>{e.durationMinutes !== null ? `${e.durationMinutes} min` : '—'}</Table.Td>
                    <Table.Td>{statusBadge}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Stack>
      </Card>
    </Stack>
  );
}
