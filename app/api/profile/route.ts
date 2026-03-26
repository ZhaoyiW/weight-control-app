import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

function calcAge(birthday: string): number {
  const today = new Date()
  const dob = new Date(birthday)
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

export async function GET() {
  try {
    const profile = await prisma.userProfile.findUnique({ where: { id: 1 } })
    if (!profile) return Response.json(null)
    return Response.json({
      ...profile,
      age: profile.birthday ? calcAge(profile.birthday) : null,
    })
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, gender, birthday, height, goalWeight, goalDays } = body

    if (!gender || !birthday || !height) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const profile = await prisma.userProfile.upsert({
      where: { id: 1 },
      update: { name: name || null, gender, birthday, height: Number(height), goalWeight: goalWeight ? Number(goalWeight) : null, goalDays: goalDays ? Number(goalDays) : null },
      create: { id: 1, name: name || null, gender, birthday, height: Number(height), goalWeight: goalWeight ? Number(goalWeight) : null, goalDays: goalDays ? Number(goalDays) : null },
    })

    return Response.json({ ...profile, age: calcAge(birthday) })
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  return POST(request)
}
