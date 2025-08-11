import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/Toast';

export function useNotifications() {
  const { addToast } = useToast();
  const [permission, setPermission] = useState('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      addToast('Notifications are not supported in this browser', 'error');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        addToast('Notifications enabled successfully!', 'success');
        return true;
      } else {
        addToast('Notification permission denied', 'warning');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      addToast('Failed to request notification permission', 'error');
      return false;
    }
  }, [isSupported, addToast]);

  const sendNotification = useCallback((title, options = {}) => {
    if (!isSupported || permission !== 'granted') {
      console.warn('Notifications not available or permission not granted');
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  }, [isSupported, permission]);

  // Notification templates for common events
  const notifyStoryCreated = useCallback((theme) => {
    return sendNotification('Story Pool Created! 🎭', {
      body: `Your "${theme}" story pool is now live and ready for contributions!`,
      tag: 'story-created'
    });
  }, [sendNotification]);

  const notifyStoryJoined = useCallback((theme) => {
    return sendNotification('Joined Story Pool! 📝', {
      body: `You've successfully joined the "${theme}" story pool!`,
      tag: 'story-joined'
    });
  }, [sendNotification]);

  const notifyNFTMinted = useCallback((tokenId) => {
    return sendNotification('NFT Minted! 🎨', {
      body: `Your story NFT #${tokenId} has been minted successfully!`,
      tag: 'nft-minted'
    });
  }, [sendNotification]);

  const notifyNewContribution = useCallback((theme, contributor) => {
    return sendNotification('New Story Contribution! ✨', {
      body: `Someone added to your "${theme}" story pool!`,
      tag: 'new-contribution'
    });
  }, [sendNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification,
    // Template notifications
    notifyStoryCreated,
    notifyStoryJoined,
    notifyNFTMinted,
    notifyNewContribution
  };
}