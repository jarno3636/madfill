'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../components/Toast'

export function useNotifications() {
  const { addToast } = useToast()
  const [permission, setPermission] = useState('default')
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsSupported('Notification' in window)
    if ('Notification' in window) {
      setPermission(window.Notification.permission)
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      addToast('Notifications are not supported in this browser', 'error')
      return false
    }
    try {
      const result = await window.Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        addToast('Notifications enabled successfully!', 'success')
        return true
      }
      addToast('Notification permission denied', 'warning')
      return false
    } catch (e) {
      console.error('Error requesting notification permission:', e)
      addToast('Failed to request notification permission', 'error')
      return false
    }
  }, [isSupported, addToast])

  const sendNotification = useCallback((title, options = {}) => {
    if (!isSupported || permission !== 'granted') return null
    try {
      const n = new window.Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      })
      setTimeout(() => n.close(), 5000)
      return n
    } catch (e) {
      console.error('Error sending notification:', e)
      return null
    }
  }, [isSupported, permission])

  const notifyStoryCreated = useCallback((theme) =>
    sendNotification('Story Pool Created! 🎭', {
      body: `Your "${theme}" story pool is now live and ready for contributions!`,
      tag: 'story-created',
    }), [sendNotification])

  const notifyStoryJoined = useCallback((theme) =>
    sendNotification('Joined Story Pool! 📝', {
      body: `You've successfully joined the "${theme}" story pool!`,
      tag: 'story-joined',
    }), [sendNotification])

  const notifyNFTMinted = useCallback((tokenId) =>
    sendNotification('NFT Minted! 🎨', {
      body: `Your story NFT #${tokenId} has been minted successfully!`,
      tag: 'nft-minted',
    }), [sendNotification])

  const notifyNewContribution = useCallback((theme, contributor) =>
    sendNotification('New Story Contribution! ✨', {
      body: `Someone added to your "${theme}" story pool!`,
      tag: 'new-contribution',
    }), [sendNotification])

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification,
    notifyStoryCreated,
    notifyStoryJoined,
    notifyNFTMinted,
    notifyNewContribution,
  }
}
