import { useKumoToastManager } from '@cloudflare/kumo';

export interface ToastOptions {
  timeout?: number;
}

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

  const success = (title: string, description?: string, options?: ToastOptions) => {
    if (manager) {
      manager.add({
        variant: 'success',
        title,
        description,
        timeout: options?.timeout ?? 4000,
      });
    }
  };

  const error = (title: string, description?: string, options?: ToastOptions) => {
    if (manager) {
      manager.add({
        variant: 'error',
        title,
        description,
        timeout: options?.timeout ?? 5000,
      });
    }
  };

  const warning = (title: string, description?: string, options?: ToastOptions) => {
    if (manager) {
      manager.add({
        variant: 'warning',
        title,
        description,
        timeout: options?.timeout ?? 4500,
      });
    }
  };

  const info = (title: string, description?: string, options?: ToastOptions) => {
    if (manager) {
      manager.add({
        variant: 'info',
        title,
        description,
        timeout: options?.timeout ?? 4000,
      });
    }
  };

  /**
   * Standardized notification for newly created resources across the project
   */
  const notifyCreated = (resourceName: string, identifier?: string) => {
    success(
      'Tạo thành công',
      identifier
        ? `Đã tạo ${resourceName} "${identifier}" thành công.`
        : `Đã tạo ${resourceName} mới thành công.`,
    );
  };

  /**
   * Standardized notification for updated/saved resources across the project
   */
  const notifyUpdated = (resourceName: string, identifier?: string) => {
    success(
      'Cập nhật thành công',
      identifier
        ? `Đã cập nhật ${resourceName} "${identifier}" thành công.`
        : `Đã lưu thay đổi ${resourceName} thành công.`,
    );
  };

  /**
   * Standardized notification for deleted resources across the project
   */
  const notifyDeleted = (resourceName: string, identifier?: string) => {
    success(
      'Xóa thành công',
      identifier
        ? `Đã xóa ${resourceName} "${identifier}" khỏi hệ thống.`
        : `Đã xóa ${resourceName} thành công.`,
    );
  };

  return {
    success,
    error,
    warning,
    info,
    notifyCreated,
    notifyUpdated,
    notifyDeleted,
    manager,
  };
}
