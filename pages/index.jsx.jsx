// pages/index.jsx
import { useState, useEffect, Fragment } from 'react'
import Head from 'next/head'
import { ethers, formatBytes32String } from 'ethers'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import abi from '../abi/FillInStoryFull.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'

export default function Home() {
  // Wallet & UI state
  const [address, setAddress] = useState(null)
  const [signer, setSigner]   = useState(null)
  const [busy, setBusy]       = useState(false)
  const [status, setStatus]   = useState('')

  // Recent winners
  const [recentWinners, setRecentWinners] = useState([])

  // Nav helper
  const navigate = (path) => (window.location.href = path)

  // Categories & Templates (7 categories × 5 templates)
  const categories = [
    {
      name: 'Cryptocurrency',
      templates: [
        { id: 'crypto1', name: 'Crypto Chaos', blanks: 5,
          parts: [
            'When Bitcoin soared to ',
            ', the community yelled ',
            '; later it dipped to ',
            ', yet traders still ',
            ', and then ',
            '.'
          ]
        },
        { id: 'crypto2', name: 'To the Moon', blanks: 5,
          parts: [
            'Every time ',
            ' tweets about ',
            ', price rockets to ',
            '! Meanwhile ',
            ' investors ',
            '.'
          ]
        },
        { id: 'crypto3', name: 'HODL Story', blanks: 5,
          parts: [
            'I bought ',
            ' at ',
            ' and promised to ',
            ' forever if it reached ',
            '.'
          ]
        },
        { id: 'crypto4', name: 'NFT Frenzy', blanks: 5,
          parts: [
            'I minted a ',
            ' NFT for ',
            ', then sold at ',
            ' ETH and bought ',
            ', celebrating until ',
            '.'
          ]
        },
        { id: 'crypto5', name: 'Meme Coin', blanks: 5,
          parts: [
            'Dogecoin hit ',
            ' cents, I ',
            ' my portfolio, then yelled ',
            ', but still ',
            ', hoping for ',
            '.'
          ]
        },
      ],
    },
    {
      name: 'Funny',
      templates: [
        { id: 'funny1', name: 'Office Antics', blanks: 5,
          parts: [
            'During meetings, I always ',
            ' the notes, ',
            ' snacks for my team, ',
            ' coffee, ',
            ' and still ',
            '.'
          ]
        },
        { id: 'funny2', name: 'Cat Chronicles', blanks: 5,
          parts: [
            'My cat ',
            ' ate the ',
            ' when I was ',
            ', then ',
            ' and ',
            '.'
          ]
        },
        { id: 'funny3', name: 'Lottery Dreams', blanks: 5,
          parts: [
            'If I won the lottery, I would ',
            ' a ',
            ', give ',
            ' to my ',
            ' and ',
            '.'
          ]
        },
        { id: 'funny4', name: 'Awkward Zoom', blanks: 5,
          parts: [
            'On Zoom calls I always ',
            ', accidentally unmute and ',
            ', while ',
            ', then ',
            '.'
          ]
        },
        { id: 'funny5', name: 'Snack Attack', blanks: 5,
          parts: [
            'I hid ',
            ' in my desk, then stole ',
            ', invited ',
            ', before ',
            ', and finally ',
            '.'
          ]
        },
      ],
    },
    {
      name: 'Pop Culture',
      templates: [
        { id: 'pop1', name: 'May the Force', blanks: 5,
          parts: [
            'May the ',
            ' be with ',
            ', always ',
            ', even when ',
            ', because ',
            '.'
          ]
        },
        { id: 'pop2', name: 'Movie Tagline', blanks: 5,
          parts: [
            'In a world where ',
            ', one ',
            ' must ',
            ' to save ',
            '.'
          ]
        },
        { id: 'pop3', name: 'Music Lyrics', blanks: 5,
          parts: [
            'I got ',
            ' on my ',
            ', feeling ',
            ' like a ',
            ' tonight.'
          ]
        },
        { id: 'pop4', name: 'Superhero Intro', blanks: 5,
          parts: [
            'By day I am a ',
            ', but by night I ',
            ' to fight ',
            ', armed with ',
            '.'
          ]
        },
        { id: 'pop5', name: 'Reality TV', blanks: 5,
          parts: [
            'On the show ',
            ', drama erupts when ',
            ' confesses ',
            ', leading to ',
            '.'
          ]
        },
      ],
    },
    {
      name: 'Animals',
      templates: [
        { id: 'animal1', name: 'Jungle Chase', blanks: 5,
          parts: [
            'The ',
            ' chased the ',
            ' over the ',
            ', through ',
            ', until ',
            '.'
          ]
        },
        { id: 'animal2', name: 'Pet Routine', blanks: 5,
          parts: [
            'Every morning, my ',
            ' likes to ',
            ' before ',
            ', then ',
            '.'
          ]
        },
        { id: 'animal3', name: 'Wildlife Safari', blanks: 5,
          parts: [
            'On safari I spotted a ',
            ' eating ',
            ', chased by a ',
            ', which then ',
            '.'
          ]
        },
        { id: 'animal4', name: 'Farm Fable', blanks: 5,
          parts: [
            'Old MacDonald had a ',
            ', he said ',
            ' and then ',
            ', under the ',
            '.'
          ]
        },
        { id: 'animal5', name: 'Ocean Adventure', blanks: 5,
          parts: [
            'I swam with the ',
            ', fed them ',
            ', while a ',
            ' watched and ',
            '.'
          ]
        },
      ],
    },
    {
      name: 'Food',
      templates: [
        { id: 'food1', name: 'Cooking Show', blanks: 5,
          parts: [
            'First, chop the ',
            ' and sauté with ',
            '; then add ',
            ' and simmer until ',
            '.'
          ]
        },
        { id: 'food2', name: 'Pizza Order', blanks: 5,
          parts: [
            'I always get ',
            ' pizza with extra ',
            ', a side of ',
            ', and a drink of ',
            '.'
          ]
        },
        { id: 'food3', name: 'Burger Bliss', blanks: 5,
          parts: [
            'Stack a ',
            ' patty, add ',
            ', top with ',
            ' and ',
            '.'
          ]
        },
        { id: 'food4', name: 'Dessert Dreams', blanks: 5,
          parts: [
            'Serve ',
            ' topped with ',

