import FillInStoryAbi from '@/lib/abi/fillInStoryV2.json'

export const fillInContract = {
  address: process.env.NEXT_PUBLIC_FILLIN_ADDRESS as `0x${string}`,
  abi: FillInStoryAbi,
} as const
