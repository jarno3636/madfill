// pages/_app.jsx
import '../styles/globals.css'
import { useEffect } from 'react'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      import('eruda').then((eruda) => {
        eruda.init()
        eruda.show()
      })
    }
  }, [])

  return <Component {...pageProps} />
}
