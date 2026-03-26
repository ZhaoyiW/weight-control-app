import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { date } = await request.json()
    if (!date) {
      return Response.json({ error: 'date required' }, { status: 400 })
    }

    // Compute yesterday
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    const yesterday = d.toISOString().split('T')[0]

    const yesterdayMeals = await prisma.mealEntry.findMany({
      where: { date: yesterday },
      orderBy: { createdAt: 'asc' },
    })

    if (yesterdayMeals.length === 0) {
      return Response.json({ copied: 0, message: 'No meals found for yesterday' })
    }

    // Create entries for today
    await prisma.mealEntry.createMany({
      data: yesterdayMeals.map((m) => ({
        date,
        mealType: m.mealType,
        foodId: m.foodId,
        customName: m.customName,
        quantity: m.quantity,
        kcal: m.kcal,
      })),
    })

    return Response.json({ copied: yesterdayMeals.length })
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to copy meals' }, { status: 500 })
  }
}
