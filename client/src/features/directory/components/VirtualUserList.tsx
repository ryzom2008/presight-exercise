import { useEffect, useRef } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { DirectoryUser } from '@presight/shared';
import { UserCard } from './UserCard';

interface Props {
  users: DirectoryUser[];
  total: number;
  hasMore: boolean;
  fetching: boolean;
  failed: boolean;
  onLoadMore: () => void;
}

export const VirtualUserList = ({ users, total, hasMore, fetching, failed, onLoadMore }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columns = useMediaQuery('(min-width: 40em)') ? 2 : 1;
  const rowCount = Math.ceil(users.length / columns);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => `${columns}-${users[index * columns]!.id}`,
    estimateSize: () => 412,
    overscan: 2,
  });
  const rows = virtualizer.getVirtualItems();
  const lastIndex = rows.at(-1)?.index ?? -1;

  useEffect(() => {
    if (lastIndex >= rowCount - 2 && lastIndex >= 0 && hasMore && !fetching && !failed) {
      onLoadMore();
    }
  }, [lastIndex, rowCount, hasMore, fetching, failed, onLoadMore]);

  return (
    <div
      ref={scrollRef}
      className="directory-scroll"
      role="region"
      aria-label="Directory results"
      tabIndex={0}
    >
      <div
        role="list"
        aria-label="People"
        style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
      >
        {rows.map((row) => (
          <div
            key={row.key}
            ref={virtualizer.measureElement}
            data-index={row.index}
            role="presentation"
            className="virtual-user-row"
            style={{
              transform: `translateY(${row.start}px)`,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {users.slice(row.index * columns, (row.index + 1) * columns).map((user, index) => (
              <div
                key={user.id}
                role="listitem"
                aria-posinset={row.index * columns + index + 1}
                aria-setsize={total}
              >
                <UserCard user={user} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
