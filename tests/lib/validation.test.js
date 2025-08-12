import {
  validateGameWord,
  validateEthValue,
  validateTemplate,
  addressSchema,
  createRoundSchema
} from '../../lib/validation'

describe('validation utilities', () => {
  describe('validateGameWord', () => {
    it('should clean and truncate words correctly', () => {
      expect(validateGameWord('hello')).toBe('hello')
      expect(validateGameWord('hello world')).toBe('hello')
      expect(validateGameWord('test-word_123')).toBe('test-word_123')
      expect(validateGameWord('hello@#$%')).toBe('hello')
      expect(validateGameWord('verylongwordthatshouldbetruncated')).toBe('verylongwordthat')
    })

    it('should handle empty or invalid inputs', () => {
      expect(validateGameWord('')).toBe('')
      expect(validateGameWord(null)).toBe('')
      expect(validateGameWord(undefined)).toBe('')
    })
  })

  describe('validateEthValue', () => {
    it('should validate ETH values correctly', () => {
      expect(validateEthValue('1')).toBe(1)
      expect(validateEthValue('0.001')).toBe(0.001)
      expect(validateEthValue('1.2345')).toBe(1.235) // Rounded to 3 decimals
      expect(validateEthValue('-1')).toBe(0) // Negative becomes 0
      expect(validateEthValue('1000')).toBe(100) // Capped at 100
      expect(validateEthValue('invalid')).toBe(0) // NaN becomes 0
    })
  })

  describe('validateTemplate', () => {
    it('should validate valid templates', () => {
      const validTemplate = {
        parts: ['Hello ', ' world', '!']
      }
      expect(() => validateTemplate(validTemplate)).not.toThrow()
    })

    it('should reject invalid templates', () => {
      expect(() => validateTemplate(null)).toThrow('Invalid template object')
      expect(() => validateTemplate({})).toThrow('Template must have parts array')
      expect(() => validateTemplate({ parts: ['single'] })).toThrow('Template must have at least 2 parts')
    })
  })

  describe('addressSchema', () => {
    it('should validate Ethereum addresses', () => {
      const validAddress = '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'
      expect(() => addressSchema.parse(validAddress)).not.toThrow()
      
      expect(() => addressSchema.parse('invalid')).toThrow()
      expect(() => addressSchema.parse('0xinvalid')).toThrow()
    })
  })

  describe('createRoundSchema', () => {
    it('should validate round creation data', () => {
      const validRound = {
        name: 'Test Round',
        theme: 'Test Theme',
        parts: ['Part 1 ', ' Part 2'],
        word: 'test',
        entryFee: 0.01,
        duration: 7,
        blankIndex: 0
      }
      
      expect(() => createRoundSchema.parse(validRound)).not.toThrow()
    })

    it('should reject invalid round data', () => {
      const invalidRound = {
        name: '',
        theme: 'Test',
        parts: ['single'],
        word: 'test@invalid',
        entryFee: 0,
        duration: 0,
        blankIndex: -1
      }
      
      expect(() => createRoundSchema.parse(invalidRound)).toThrow()
    })
  })
})