import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const date = searchParams.get('date')

    if (!date) {
      return Response.json({ error: 'date parameter required' }, { status: 400 })
    }

    const meals = await prisma.mealEntry.findMany({
      where: { date },
      include: { food: true },
      orderBy: { createdAt: 'asc' },
    })

    return Response.json(meals)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to fetch meals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, mealType, foodId, quantity, customName, kcal: customKcal } = body

    if (!date || !mealType) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Custom entry: name + kcal directly, no food library item
    if (customName && customKcal !== undefined) {
      const entry = await prisma.mealEntry.create({
        data: {
          date,
          mealType,
          customName,
          quantity: 1,
          kcal: Math.round(Number(customKcal)),
        },
        include: { food: true },
      })
      return Response.json(entry, { status: 201 })
    }

    // Library entry
    if (!foodId || quantity === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const food = await prisma.foodItem.findUnique({ where: { id: Number(foodId) } })
    if (!food) {
      return Response.json({ error: 'Food not found' }, { status: 404 })
    }

    const kcal = (food.kcalPerServing / food.servingAmount) * Number(quantity)

    const entry = await prisma.mealEntry.create({
      data: {
        date,
        mealType,
        foodId: Number(foodId),
        quantity: Number(quantity),
        kcal: Math.round(kcal),
      },
      include: { food: true },
    })

    return Response.json(entry, { status: 201 })
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to create meal entry' }, { status: 500 })
  }
}
