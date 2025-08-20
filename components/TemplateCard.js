// components/TemplateCard.js
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { openCast } from '@/lib/cast'

export default function TemplateCard({ item }) {
  const handleCast = () => {
    const castText = `${item.name}\n\n${item.story || item.description}\n\n#MiniApp`
    openCast({
      text: castText,
      embeds: item.image ? [item.image] : []
    })
  }

  return (
    <Card className="mb-6 shadow-lg rounded-2xl bg-white">
      <CardContent className="p-6">
        {item.image && (
          <img src={item.image} alt={item.name} className="rounded-xl mb-4 w-full" />
        )}
        <h2 className="text-2xl font-bold mb-2">{item.name}</h2>
        <p className="text-lg mb-4 whitespace-pre-line">{item.story || item.description}</p>
        <Button onClick={handleCast} className="w-full">Cast This</Button>
      </CardContent>
    </Card>
  )
}
