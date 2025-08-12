import { z } from 'zod'

// Contract address validation
export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')

// Game round validation
export const createRoundSchema = z.object({
  name: z.string().min(1, 'Round name is required').max(48, 'Round name too long'),
  theme: z.string().min(1, 'Theme is required'),
  parts: z.array(z.string()).min(2, 'Template must have at least 2 parts'),
  word: z.string()
    .min(1, 'Word is required')
    .max(16, 'Word too long')
    .regex(/^[a-zA-Z0-9\-_]+$/, 'Word can only contain letters, numbers, hyphens, and underscores'),
  entryFee: z.number().min(0.001, 'Entry fee must be at least 0.001 ETH').max(10, 'Entry fee too high'),
  duration: z.number().min(1, 'Duration must be at least 1 day').max(30, 'Duration cannot exceed 30 days'),
  blankIndex: z.number().min(0, 'Invalid blank index'),
})

export const joinRoundSchema = z.object({
  poolId: z.number().min(1, 'Invalid pool ID'),
  word: z.string()
    .min(1, 'Word is required')
    .max(16, 'Word too long')
    .regex(/^[a-zA-Z0-9\-_]+$/, 'Word can only contain letters, numbers, hyphens, and underscores'),
  blankIndex: z.number().min(0, 'Invalid blank index'),
  entryFee: z.number().min(0, 'Invalid entry fee'),
})

// NFT minting validation
export const mintNFTSchema = z.object({
  storyContent: z.string().min(10, 'Story content too short').max(1000, 'Story content too long'),
  metadata: z.string().optional(),
})

// User input sanitization
export const sanitizeInput = (input, maxLength = 100) => {
  if (typeof input !== 'string') return ''
  
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
}

// Word validation for game submissions
export const validateGameWord = (word) => {
  const sanitized = sanitizeInput(word, 16)
  
  // Remove any non-alphanumeric characters except hyphens and underscores
  const cleaned = sanitized.replace(/[^a-zA-Z0-9\-_]/g, '')
  
  // Take only the first word if multiple words were provided
  const singleWord = cleaned.split(/[\s\-_]+/)[0]
  
  return singleWord.slice(0, 16)
}

// Ethereum value validation
export const validateEthValue = (value) => {
  const num = parseFloat(value)
  if (isNaN(num) || num < 0) return 0
  if (num > 100) return 100 // Reasonable maximum
  return Math.round(num * 1000) / 1000 // Round to 3 decimal places
}

// Template validation
export const validateTemplate = (template) => {
  if (!template || typeof template !== 'object') {
    throw new Error('Invalid template object')
  }
  
  if (!template.parts || !Array.isArray(template.parts)) {
    throw new Error('Template must have parts array')
  }
  
  if (template.parts.length < 2) {
    throw new Error('Template must have at least 2 parts')
  }
  
  const blanks = template.parts.length - 1
  if (template.blanks !== undefined && template.blanks !== blanks) {
    throw new Error('Template blanks count mismatch')
  }
  
  return true
}

// Environment variable validation
export const validateEnvVars = () => {
  const required = [
    'NEXT_PUBLIC_FILLIN_ADDRESS',
    'NEXT_PUBLIC_MADFILL_NFT_ADDRESS',
    'NEXT_PUBLIC_BASE_RPC',
  ]
  
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.warn('Missing environment variables:', missing)
    return false
  }
  
  // Validate contract addresses
  try {
    addressSchema.parse(process.env.NEXT_PUBLIC_FILLIN_ADDRESS)
    addressSchema.parse(process.env.NEXT_PUBLIC_MADFILL_NFT_ADDRESS)
  } catch (error) {
    console.error('Invalid contract address in environment:', error.message)
    return false
  }
  
  return true
}

// Rate limiting validation
export const createRateLimiter = (maxRequests = 10, windowMs = 60000) => {
  const requests = new Map()
  
  return (key) => {
    const now = Date.now()
    const windowStart = now - windowMs
    
    if (!requests.has(key)) {
      requests.set(key, [])
    }
    
    const keyRequests = requests.get(key)
    
    // Remove old requests outside the window
    const validRequests = keyRequests.filter(time => time > windowStart)
    requests.set(key, validRequests)
    
    if (validRequests.length >= maxRequests) {
      return false // Rate limit exceeded
    }
    
    validRequests.push(now)
    return true // Request allowed
  }
}

export const contractCallRateLimit = createRateLimiter(5, 30000) // 5 calls per 30 seconds