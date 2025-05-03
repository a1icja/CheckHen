import { useState } from 'react';
import cx from 'clsx';
import { ScrollArea, Table } from '@mantine/core';
import classes from './TableScrollArea.module.css';

export function TableScrollArea({
  columns,
  data,
}: {
  columns: string[];
  data: Record<string, any>[];
}) {
  const [scrolled, setScrolled] = useState(false);

  const rows = data.map((row) => (
    <Table.Tr key={row.id}>
      {Object.keys(row).map((key) => (
        <Table.Td key={key}>{row[key]}</Table.Td>
      ))}
    </Table.Tr>
  ));

  return (
    <ScrollArea h={300} onScrollPositionChange={({ y }) => setScrolled(y !== 0)}>
      {/* TODO: Figure out how to sort */}
      <Table stickyHeader aria-sort='ascending' striped highlightOnHover variant="vertical">
        <Table.Thead className={cx(classes.header, { [classes.scrolled]: scrolled })}>
          <Table.Tr>
            {columns.map((column) => (
              <Table.Th key={column}>{column}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
