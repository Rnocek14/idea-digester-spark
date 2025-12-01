import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Operation {
  id: string;
  type: 'voice-generation' | 'image-generation' | 'post-preparation' | 'bulk-approval';
  status: 'running' | 'completed' | 'failed';
  message: string;
  startedAt: number;
  estimatedMinutes?: number;
  toastId?: string | number;
}

interface OperationsContextType {
  operations: Operation[];
  startOperation: (type: Operation['type'], message: string, estimatedMinutes?: number) => string;
  completeOperation: (id: string, successMessage?: string) => void;
  failOperation: (id: string, errorMessage?: string) => void;
  getActiveOperations: () => Operation[];
  hasActiveOperation: (type?: Operation['type']) => boolean;
}

const OperationsContext = createContext<OperationsContextType | undefined>(undefined);

const STORAGE_KEY = 'ongoing-operations';

export const OperationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [operations, setOperations] = useState<Operation[]>(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Clean up old operations (older than 30 minutes)
        const now = Date.now();
        return parsed.filter((op: Operation) => now - op.startedAt < 30 * 60 * 1000);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Persist to localStorage whenever operations change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(operations));
  }, [operations]);

  const startOperation = useCallback((type: Operation['type'], message: string, estimatedMinutes?: number) => {
    const id = `${type}-${Date.now()}`;
    const operation: Operation = {
      id,
      type,
      status: 'running',
      message,
      startedAt: Date.now(),
      estimatedMinutes,
    };

    // Show persistent loading toast
    const toastId = toast.loading(
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <div>
          <p className="font-medium">{message}</p>
          {estimatedMinutes && (
            <p className="text-xs text-muted-foreground">
              Estimated time: ~{estimatedMinutes} minute{estimatedMinutes !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>,
      {
        duration: Infinity, // Never auto-dismiss
      }
    );

    operation.toastId = toastId;

    setOperations(prev => [...prev, operation]);
    return id;
  }, []);

  const completeOperation = useCallback((id: string, successMessage?: string) => {
    setOperations(prev => {
      const operation = prev.find(op => op.id === id);
      if (operation?.toastId) {
        toast.dismiss(operation.toastId);
        if (successMessage) {
          toast.success(successMessage);
        }
      }
      return prev.filter(op => op.id !== id);
    });
  }, []);

  const failOperation = useCallback((id: string, errorMessage?: string) => {
    setOperations(prev => {
      const operation = prev.find(op => op.id === id);
      if (operation?.toastId) {
        toast.dismiss(operation.toastId);
        if (errorMessage) {
          toast.error(errorMessage);
        }
      }
      return prev.filter(op => op.id !== id);
    });
  }, []);

  const getActiveOperations = useCallback(() => {
    return operations.filter(op => op.status === 'running');
  }, [operations]);

  const hasActiveOperation = useCallback((type?: Operation['type']) => {
    const active = operations.filter(op => op.status === 'running');
    if (!type) return active.length > 0;
    return active.some(op => op.type === type);
  }, [operations]);

  return (
    <OperationsContext.Provider
      value={{
        operations,
        startOperation,
        completeOperation,
        failOperation,
        getActiveOperations,
        hasActiveOperation,
      }}
    >
      {children}
    </OperationsContext.Provider>
  );
};

export const useOperations = () => {
  const context = useContext(OperationsContext);
  if (!context) {
    throw new Error('useOperations must be used within OperationsProvider');
  }
  return context;
};
