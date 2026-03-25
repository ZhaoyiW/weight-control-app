import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const url = process.env.DATABASE_URL || 'file:./prisma/dev.db'
const adapter = new PrismaBetterSqlite3({ url })
const prisma = new PrismaClient({ adapter })

function pastDate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function main() {
  console.log('Seeding database...')

  // UserProfile
  await prisma.userProfile.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      gender: 'female',
      height: 165,
    },
  })
  console.log('Created UserProfile')

  // WeightLog - last 5 days ~60kg
  const weightEntries = [
    { daysAgo: 0, weight: 60.2 },
    { daysAgo: 1, weight: 60.4 },
    { daysAgo: 2, weight: 60.1 },
    { daysAgo: 3, weight: 60.5 },
    { daysAgo: 4, weight: 60.8 },
  ]

  for (const { daysAgo, weight } of weightEntries) {
    await prisma.weightLog.upsert({
      where: { date: pastDate(daysAgo) },
      update: { weight },
      create: { date: pastDate(daysAgo), weight },
    })
  }
  console.log('Created WeightLogs')

  // FoodItems
  const foods = [
    { name: 'White Rice (cooked)', servingUnit: 'g', servingAmount: 100, kcalPerServing: 130 },
    { name: 'Chicken Breast (grilled)', servingUnit: 'g', servingAmount: 100, kcalPerServing: 165 },
    { name: 'Egg (large)', servingUnit: 'piece', servingAmount: 1, kcalPerServing: 78 },
    { name: 'Banana', servingUnit: 'piece', servingAmount: 1, kcalPerServing: 105 },
    { name: 'Whole Milk', servingUnit: 'ml', servingAmount: 240, kcalPerServing: 149 },
    { name: 'Oatmeal (cooked)', servingUnit: 'cup', servingAmount: 1, kcalPerServing: 158 },
    { name: 'Greek Yogurt (plain)', servingUnit: 'g', servingAmount: 100, kcalPerServing: 59 },
    { name: 'Avocado', servingUnit: 'piece', servingAmount: 1, kcalPerServing: 240 },
    { name: 'Almonds', servingUnit: 'g', servingAmount: 30, kcalPerServing: 173 },
    { name: 'Broccoli (cooked)', servingUnit: 'cup', servingAmount: 1, kcalPerServing: 55 },
  ]

  const createdFoods: Array<{ id: number; name: string; servingAmount: number; kcalPerServing: number }> = []
  for (const food of foods) {
    const existing = await prisma.foodItem.findFirst({ where: { name: food.name } })
    if (!existing) {
      const created = await prisma.foodItem.create({ data: food })
      createdFoods.push(created)
    } else {
      createdFoods.push(existing)
    }
  }
  console.log('Created FoodItems')

  // MealEntries for today
  const today = pastDate(0)
  const rice = createdFoods.find((f) => f.name === 'White Rice (cooked)')
  const chicken = createdFoods.find((f) => f.name === 'Chicken Breast (grilled)')
  const egg = createdFoods.find((f) => f.name === 'Egg (large)')
  const banana = createdFoods.find((f) => f.name === 'Banana')
  const oatmeal = createdFoods.find((f) => f.name === 'Oatmeal (cooked)')

  const mealEntries = [
    rice && { date: today, mealType: 'breakfast', foodId: oatmeal!.id, quantity: 1, kcal: Math.round((oatmeal!.kcalPerServing / oatmeal!.servingAmount) * 1) },
    egg && { date: today, mealType: 'breakfast', foodId: egg.id, quantity: 2, kcal: Math.round((egg.kcalPerServing / egg.servingAmount) * 2) },
    chicken && { date: today, mealType: 'lunch', foodId: chicken.id, quantity: 150, kcal: Math.round((chicken.kcalPerServing / chicken.servingAmount) * 150) },
    rice && { date: today, mealType: 'lunch', foodId: rice.id, quantity: 200, kcal: Math.round((rice.kcalPerServing / rice.servingAmount) * 200) },
    banana && { date: today, mealType: 'snack', foodId: banana.id, quantity: 1, kcal: Math.round((banana.kcalPerServing / banana.servingAmount) * 1) },
  ].filter(Boolean) as Array<{ date: string; mealType: string; foodId: number; quantity: number; kcal: number }>

  for (const entry of mealEntries) {
    await prisma.mealEntry.create({ data: entry })
  }
  console.log('Created MealEntries')

  // DailyActivity for today
  await prisma.dailyActivity.upsert({
    where: { date: today },
    update: { exerciseKcal: 300 },
    create: { date: today, exerciseKcal: 300 },
  })
  console.log('Created DailyActivity')

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
