// pages/_app.jsx
import { useEffect } from 'react'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // only run in browser
    if (typeof window !== 'undefined') {
      import('eruda').then(eruda => {
        eruda.init()
        // optional: open console automatically
        // eruda.show()
      })
    }
  }, [])

  return <Component {...pageProps} />
}
