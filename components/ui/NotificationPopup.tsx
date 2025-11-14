
import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';

interface NotificationPopupProps {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  onClose: () => void;
}

const NotificationPopup: React.FC<NotificationPopupProps> = ({ message, type, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [message]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Allow for fade out animation
  };
  
  const typeClasses = {
    info: 'bg-sky-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };

  return (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[1000] w-11/12 max-w-md p-4 rounded-lg shadow-2xl text-white ${typeClasses[type]} transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 pt-0.5">
          <Bell className="h-6 w-6" />
        </div>
        <div className="ms-3 flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <div className="ms-4 flex-shrink-0 flex">
          <button onClick={handleClose} className="inline-flex rounded-md text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
            <span className="sr-only">إغلاق</span>
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPopup;
