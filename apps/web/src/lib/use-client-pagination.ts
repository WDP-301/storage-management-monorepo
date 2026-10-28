import { useEffect, useState } from 'react';

/**
 * Pages a list that is already fully loaded. Goes back to page 1 whenever `resetKey` changes
 * (a new search or filter), and never strands the view on a page emptied by a delete.
 */
export function useClientPagination<T>(items: T[], pageSize: number, resetKey: unknown) {
  const [page, setPage] = useState(1);
  // resetKey only signals a reset; its value is never read.
  useEffect(() => setPage(1), [resetKey]);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  return {
    page: current,
    setPage,
    pageItems: items.slice((current - 1) * pageSize, current * pageSize),
    /** Pagination controls are only worth showing past one page. */
    paged: items.length > pageSize,
  };
}
