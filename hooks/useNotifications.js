// hooks/useNotifications.js
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../components/Toast'

export function useNotifications() {
  const { addToast } = useToast()
  const [permission, setPermission] = useState('default')
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const supported = 'Notification' in window
    setIsSupported(supported)
    if (supported) {
      setPermission(window.Notification.permission)
    }
  }, [])

  const toast = useCallback((type, message, title) => {
    // Normalize toast usage to provider’s object API
    addToast({
      type,
      title,
      message,
      duration: 5000,
    })
  }, [addToast])

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined') return false

    if (!isSupported) {
      toast('error', 'Notifications are not supported in this browser.')
      return false
    }
    if (!window.isSecureContext) {
      toast('warning', 'Enable HTTPS to use notifications.')
      return false
    }

    try {
      const result = await window.Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        toast('success', 'Notifications enabled successfully!')
        return true
      }
      toast('warning', 'Notification permission denied.')
      return false
    } catch (e) {
      console.error('Error requesting notification permission:', e)
      toast('error', 'Failed to request notification permission.')
      return false
    }
  }, [isSupported, toast])

  const sendNotification = useCallback((title, options = {}) => {
    if (typeof window === 'undefined') return null
    if (!isSupported || permission !== 'granted') return null
    try {
      const n = new window.Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      })
      // Auto-close after 5s to avoid piling up
      setTimeout(() => n.close(), 5000)
      return n
    } catch (e) {
      console.error('Error sending notification:', e)
      toast('error', 'Failed to show notification.')
      return null
    }
  }, [isSupported, permission, toast])

  const notifyStoryCreated = useCallback(
    (theme) =>
      sendNotification('Story Pool Created! 🎭', {
        body: `Your "${theme}" story pool is now live and ready for contributions!`,
        tag: 'story-created',
      }),
    [sendNotification]
  )

  const notifyStoryJoined = useCallback(
    (theme) =>
      sendNotification('Joined Story Pool! 📝', {
        body: `You’ve successfully joined the "${theme}" story pool!`,
        tag: 'story-joined',
      }),
    [sendNotification]
  )

  const notifyNFTMinted = useCallback(
    (tokenId) =>
      sendNotification('NFT Minted! 🎨', {
        body: `Your story NFT #${tokenId} has been minted successfully!`,
        tag: 'nft-minted',
      }),
    [sendNotification]
  )

  const notifyNewContribution = useCallback(
    (theme, contributor) =>
      sendNotification('New Story Contribution! ✨', {
        body: contributor
          ? `${contributor} added to your "${theme}" story pool!`
          : `Someone added to your "${theme}" story pool!`,
        tag: 'new-contribution',
      }),
    [sendNotification]
  )

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
