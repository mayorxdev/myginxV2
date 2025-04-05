import { useEffect } from "react";

interface ErrorAlertProps {
  message: string;
  onClose?: () => void;
  autoHideDuration?: number;
}

export default function ErrorAlert({
  message,
  onClose,
  autoHideDuration = 5000,
}: ErrorAlertProps) {
  useEffect(() => {
    if (onClose && autoHideDuration) {
      const timer = setTimeout(onClose, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [onClose, autoHideDuration]);

  return (
    <div className="fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
      <span>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-2 text-white hover:text-gray-200"
        >
          ✕
        </button>
      )}
    </div>
  );
}
