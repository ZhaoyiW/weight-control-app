import { prisma } from '@/lib/prisma'
import { classifyFood } from '@/lib/classify'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const q = searchParams.get('q')
    const category = searchParams.get('category')

    const foods = await prisma.foodItem.findMany({
      where: {
        ...(q ? { name: { contains: q } } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: [{ name: 'asc' }],
    })
    return Response.json(foods)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to fetch foods' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, category, servingUnit, servingAmount, kcalPerServing } = body

    if (!name || !servingUnit || servingAmount === undefined || kcalPerServing === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Auto-classify if no category provided and API key is available
    let resolvedCategory = category || null
    if (!resolvedCategory && process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your-api-key-here') {
      resolvedCategory = await classifyFood(name).catch(() => null)
    }

    const food = await prisma.foodItem.create({
      data: {
        name,
        category: resolvedCategory,
        servingUnit,
        servingAmount: Number(servingAmount),
        kcalPerServing: Number(kcalPerServing),
      },
    })

    return Response.json(food, { status: 201 })
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to create food' }, { status: 500 })
  }
}
