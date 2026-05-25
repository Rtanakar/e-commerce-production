import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

export default function Home() {
  return (
    <main>
      <Button>BTN</Button>
      <Button variant="destructive">Delete</Button>
      <Input placeholder="Enter text..." />
    </main>
  )
}
