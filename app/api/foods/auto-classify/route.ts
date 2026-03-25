import { prisma } from '@/lib/prisma'
import { classifyFoods } from '@/lib/classify'

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-api-key-here') {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  try {
    // Get all foods without a category
    console.log('auto-classify: fetching unclassified foods')
    const unclassified = await prisma.foodItem.findMany({
      where: { category: { equals: null } },
      select: { id: true, name: true },
    })
    console.log('auto-classify: found', unclassified.length, 'unclassified foods')

    if (unclassified.length === 0) {
      return Response.json({ updated: 0, message: 'All foods already classified' })
    }

    // Classify in batches of 30 to stay within token limits
    const BATCH = 30
    let updated = 0

    for (let i = 0; i < unclassified.length; i += BATCH) {
      const batch = unclassified.slice(i, i + BATCH)
      const names = batch.map((f) => f.name)
      console.log('auto-classify: classifying batch', names)
      const classifications = await classifyFoods(names)
      console.log('auto-classify: classifications result', classifications)

      for (const food of batch) {
        const category = classifications[food.name]
        if (category) {
          await prisma.foodItem.update({
            where: { id: food.id },
            data: { category },
          })
          updated++
        }
      }
    }

    return Response.json({ updated, total: unclassified.length })
  } catch (error) {
    console.error('Auto-classify error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return Response.json({ error: 'Classification failed', detail: msg }, { status: 500 })
  }
}
