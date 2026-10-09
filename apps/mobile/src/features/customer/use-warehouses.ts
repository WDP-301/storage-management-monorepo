import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { buildWarehouseQuery } from '../../../lib/warehouse-query';
import { WarehousesApi } from '../../../lib/warehouses-api';
import type { BrowseCriteria } from '../../types/customer';
import type { Warehouse } from '../../types/storage-api';

type State = {
  warehouses: Warehouse[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
};

const INITIAL_STATE: State = {
  warehouses: [],
  total: 0,
  page: 0,
  totalPages: 0,
  isLoading: true,
  isLoadingMore: false,
  error: null,
};

/** Server-filtered, paged warehouse list. Any criteria change restarts from page 1. */
export function useWarehouses(criteria: BrowseCriteria) {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [reloadToken, setReloadToken] = useState(0);
  const criteriaRef = useRef(criteria);
  criteriaRef.current = criteria;
  const queryKey = buildWarehouseQuery(criteria);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, isLoading: true, error: null }));

    const load = async () => {
      try {
        const result = await WarehousesApi.list(criteriaRef.current, 1, controller.signal);
        if (controller.signal.aborted) return;
        setState({
          warehouses: result.warehouses,
          total: result.meta.total,
          page: result.meta.page,
          totalPages: result.meta.totalPages,
          isLoading: false,
          isLoadingMore: false,
          error: null,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((current) => ({ ...current, isLoading: false, error: toErrorMessage(error) }));
      }
    };

    void load();
    return () => controller.abort();
  }, [queryKey, reloadToken]);

  const loadMore = useCallback(async () => {
    if (state.isLoading || state.isLoadingMore || state.page >= state.totalPages) return;
    const requestedKey = buildWarehouseQuery(criteriaRef.current);
    setState((current) => ({ ...current, isLoadingMore: true }));
    try {
      const result = await WarehousesApi.list(criteriaRef.current, state.page + 1);
      // Criteria changed mid-flight: the restart owns the state now.
      if (requestedKey !== buildWarehouseQuery(criteriaRef.current)) return;
      setState((current) => {
        const known = new Set(current.warehouses.map((warehouse) => warehouse.id));
        return {
          ...current,
          warehouses: [
            ...current.warehouses,
            ...result.warehouses.filter((warehouse) => !known.has(warehouse.id)),
          ],
          total: result.meta.total,
          page: result.meta.page,
          totalPages: result.meta.totalPages,
          isLoadingMore: false,
        };
      });
    } catch (error) {
      setState((current) => ({ ...current, isLoadingMore: false, error: toErrorMessage(error) }));
    }
  }, [state.isLoading, state.isLoadingMore, state.page, state.totalPages]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, hasMore: state.page < state.totalPages, loadMore, refetch };
}

function toErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return 'Không tải được danh sách kho. Vui lòng thử lại.';
}
