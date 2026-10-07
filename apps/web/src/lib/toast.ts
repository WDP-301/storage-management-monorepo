import { useKumoToastManager } from '@cloudflare/kumo';
import { useMemo, useRef } from 'react';

export interface ToastOptions {
  timeout?: number;
}

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

const DEFAULT_TIMEOUTS: Record<ToastVariant, number> = {
  success: 4000,
  error: 5000,
  warning: 4500,
  info: 4000,
};

/**
 * Project-wide Toast notification hook built on Cloudflare Kumo UI (<Toasty>).
 * Provides clean helpers for success, error, warning, info, and standardized
 * notifications for create, update, delete actions across all features.
 */
export function useAppToast() {
  let manager: ReturnType<typeof useKumoToastManager> | null = null;
  try {
    manager = useKumoToastManager();
  } catch {
    // Fallback if rendered outside of <Toasty> context (e.g. isolated test environments)
    manager = null;
  }

  // `useKumoToastManager` returns a fresh object every render, so it can't be a
  // useMemo dep. Keep the latest in a ref and memoize the API once — the
  // returned object must be referentially stable or anything that puts `toast`
  // in a useCallback/useEffect dep will loop forever.
  const managerRef = useRef(manager);
  managerRef.current = manager;

  return useMemo(() => {
    const add = (
      variant: ToastVariant,
      title: string,
      description?: string,
      options?: ToastOptions,
    ) => {
      managerRef.current?.add({
        variant,
        title,
        description,
        timeout: options?.timeout ?? DEFAULT_TIMEOUTS[variant],
      });
    };

    const success = (title: string, description?: string, options?: ToastOptions) =>
      add('success', title, description, options);

    return {
      success,
      error: (title: string, description?: string, options?: ToastOptions) =>
        add('error', title, description, options),
      warning: (title: string, description?: string, options?: ToastOptions) =>
        add('warning', title, description, options),
      info: (title: string, description?: string, options?: ToastOptions) =>
        add('info', title, description, options),

      /**
       * Standardized notification for newly created resources across the project
       */
      notifyCreated: (resourceName: string, identifier?: string) =>
        success(
          'Tạo thành công',
          identifier
            ? `Đã tạo ${resourceName} "${identifier}" thành công.`
            : `Đã tạo ${resourceName} mới thành công.`,
        ),

      /**
       * Standardized notification for updated/saved resources across the project
       */
      notifyUpdated: (resourceName: string, identifier?: string) =>
        success(
          'Cập nhật thành công',
          identifier
            ? `Đã cập nhật ${resourceName} "${identifier}" thành công.`
            : `Đã lưu thay đổi ${resourceName} thành công.`,
        ),

      /**
       * Standardized notification for deleted resources across the project
       */
      notifyDeleted: (resourceName: string, identifier?: string) =>
        success(
          'Xóa thành công',
          identifier
            ? `Đã xóa ${resourceName} "${identifier}" khỏi hệ thống.`
            : `Đã xóa ${resourceName} thành công.`,
        ),

      get manager() {
        return managerRef.current;
      },
    };
  }, []);
}
