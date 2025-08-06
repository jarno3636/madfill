import FillInStoryV2_ABI from '@/abi/FillInStoryV2_ABI.json'

export const fillInContract = {
  address: process.env.NEXT_PUBLIC_FILLIN_ADDRESS as `0x${string}`,
  abi: FillInStoryV2_ABI,
} as const
