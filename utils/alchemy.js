// utils/alchemy.js
import { Alchemy, Network } from "alchemy-sdk"

const settings = {
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_KEY,
  network: Network.BASE
}

if (!settings.apiKey) {
  throw new Error("Missing NEXT_PUBLIC_ALCHEMY_KEY in .env.local")
}

export const alchemy = new Alchemy(settings)
