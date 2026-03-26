import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { quantity } = body

    if (quantity === undefined) {
      return Response.json({ error: 'quantity required' }, { status: 400 })
    }

    const existing = await prisma.mealEntry.findUnique({
      where: { id: Number(id) },
      include: { food: true },
    })

    if (!existing) {
      return Response.json({ error: 'Meal entry not found' }, { status: 404 })
    }

    let kcal: number
    if (existing.food) {
      kcal = (existing.food.kcalPerServing / existing.food.servingAmount) * Number(quantity)
    } else {
      // Custom entry: quantity is kcal directly
      kcal = Number(quantity)
    }

    const entry = await prisma.mealEntry.update({
      where: { id: Number(id) },
      data: { quantity: Number(quantity), kcal: Math.round(kcal) },
      include: { food: true },
    })

    return Response.json(entry)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to update meal entry' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.mealEntry.delete({ where: { id: Number(id) } })
    return Response.json({ success: true })
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to delete meal entry' }, { status: 500 })
  }
}
