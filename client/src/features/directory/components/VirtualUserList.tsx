import { useEffect, useRef } from 'react';
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
  const virtualizer = useVirtualizer({
    count: users.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => users[index]!.id,
    estimateSize: () => 156,
    overscan: 4,
  });
  const rows = virtualizer.getVirtualItems();
  const lastIndex = rows.at(-1)?.index ?? -1;

  useEffect(() => {
    if (lastIndex >= users.length - 3 && lastIndex >= 0 && hasMore && !fetching && !failed) {
      onLoadMore();
    }
  }, [lastIndex, users.length, hasMore, fetching, failed, onLoadMore]);

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
            role="listitem"
            aria-posinset={row.index + 1}
            aria-setsize={total}
            className="virtual-user-row"
            style={{ transform: `translateY(${row.start}px)` }}
          >
            <UserCard user={users[row.index]!} />
          </div>
        ))}
      </div>
    </div>
  );
};
