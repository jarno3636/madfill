// lib/validation.js
import { z } from 'zod'

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')

export function formatAddress(addr) {
  if (!addr || typeof addr !== 'string' || addr.length < 10) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export const createRoundSchema = z.object({
  name: z.string().min(1).max(48),
  theme: z.string().min(1),
  parts: z.array(z.string()).min(2),
  word: z.string().min(1).max(16).regex(/^[a-zA-Z0-9\-_]+$/),
  entryFee: z.number().min(0.001).max(10),
  duration: z.number().min(1).max(30),
  blankIndex: z.number().min(0),
})

export const joinRoundSchema = z.object({
  poolId: z.number().min(1),
  word: z.string().min(1).max(16).regex(/^[a-zA-Z0-9\-_]+$/),
  blankIndex: z.number().min(0),
  entryFee: z.number().min(0),
})

export const mintNFTSchema = z.object({
  storyContent: z.string().min(10).max(1000),
  metadata: z.string().optional(),
})

export const sanitizeInput = (input, maxLength = 100) => {
  if (typeof input !== 'string') return ''
  return input.trim().slice(0, maxLength).replace(/[<>]/g, '').replace(/javascript:/gi, '')
}

export const validateGameWord = (word) => {
  const sanitized = sanitizeInput(word, 16)
  const cleaned = sanitized.replace(/[^a-zA-Z0-9\-_]/g, '')
  const singleWord = cleaned.split(/[\s\-_]+/)[0]
  return singleWord.slice(0, 16)
}

export const validateEthValue = (value) => {
  const num = parseFloat(value)
  if (isNaN(num) || num < 0) return 0
  if (num > 100) return 100
  return Math.round(num * 1000) / 1000
}

export const validateTemplate = (template) => {
  if (!template || typeof template !== 'object') throw new Error('Invalid template object')
  if (!Array.isArray(template.parts)) throw new Error('Template must have parts array')
  if (template.parts.length < 2) throw new Error('Template must have at least 2 parts')
  const blanks = template.parts.length - 1
  if (template.blanks !== undefined && template.blanks !== blanks) {
    throw new Error('Template blanks count mismatch')
  }
  return true
}

export const validateEnvVars = () => {
  const required = ['NEXT_PUBLIC_FILLIN_ADDRESS', 'NEXT_PUBLIC_MADFILL_NFT_ADDRESS', 'NEXT_PUBLIC_BASE_RPC']
  const missing = required.filter(k => !process.env[k])
  if (missing.length) {
    console.warn('Missing environment variables:', missing)
    return false
  }
  try {
    addressSchema.parse(process.env.NEXT_PUBLIC_FILLIN_ADDRESS)
    addressSchema.parse(process.env.NEXT_PUBLIC_MADFILL_NFT_ADDRESS)
  } catch (e) {
    console.error('Invalid contract address in environment:', e?.message)
    return false
  }
  return true
}

export const createRateLimiter = (maxRequests = 5, windowMs = 30000) => {
  const requests = new Map()
  return (key) => {
    const now = Date.now()
    const start = now - windowMs
    const arr = (requests.get(key) || []).filter(t => t > start)
    if (arr.length >= maxRequests) return false
    arr.push(now)
    requests.set(key, arr)
    return true
  }
}

export const contractCallRateLimit = createRateLimiter(5, 30000)
