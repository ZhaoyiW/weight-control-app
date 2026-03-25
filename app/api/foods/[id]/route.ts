import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, category, servingUnit, servingAmount, kcalPerServing } = body

    const food = await prisma.foodItem.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category: category || null }),
        ...(servingUnit !== undefined && { servingUnit }),
        ...(servingAmount !== undefined && { servingAmount: Number(servingAmount) }),
        ...(kcalPerServing !== undefined && { kcalPerServing: Number(kcalPerServing) }),
      },
    })

    return Response.json(food)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to update food' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if any meal entries reference this food
    const mealCount = await prisma.mealEntry.count({ where: { foodId: Number(id) } })
    if (mealCount > 0) {
      // Delete associated meal entries first
      await prisma.mealEntry.deleteMany({ where: { foodId: Number(id) } })
    }

    await prisma.foodItem.delete({ where: { id: Number(id) } })

    return Response.json({ success: true })
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to delete food' }, { status: 500 })
  }
}
