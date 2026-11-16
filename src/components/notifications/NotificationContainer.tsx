import React from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import Toast from './Toast';

const NotificationContainer: React.FC = () => {
  const { notifications } = useNotification();

  return (
    <div className="fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 pointer-events-none sm:right-6 sm:top-6">
      {notifications.map((notification) => (
        <Toast key={notification.id} notification={notification} />
      ))}
    </div>
  );
};

export default NotificationContainer;
