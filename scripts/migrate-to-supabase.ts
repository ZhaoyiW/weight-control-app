/**
 * Migrate all data from local SQLite (dev.db) to Supabase.
 * Usage: npx tsx scripts/migrate-to-supabase.ts
 */

import path from 'path'
import Database from 'better-sqlite3'
import { PrismaClient } from '../app/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const dbPath = path.resolve(__dirname, '../dev.db')
const db = new Database(dbPath, { readonly: true })

const pgAdapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const pg = new PrismaClient({ adapter: pgAdapter })

async function main() {
  console.log('Reading from SQLite:', dbPath)

  const profile    = db.prepare('SELECT * FROM UserProfile').all() as any[]
  const weightLogs = db.prepare('SELECT * FROM WeightLog').all() as any[]
  const foodItems  = db.prepare('SELECT * FROM FoodItem').all() as any[]
  const mealEntries = db.prepare('SELECT * FROM MealEntry').all() as any[]
  const activities = db.prepare('SELECT * FROM DailyActivity').all() as any[]

  console.log(`  UserProfile:   ${profile.length}`)
  console.log(`  WeightLog:     ${weightLogs.length}`)
  console.log(`  FoodItem:      ${foodItems.length}`)
  console.log(`  MealEntry:     ${mealEntries.length}`)
  console.log(`  DailyActivity: ${activities.length}`)

  console.log('\nWriting to Supabase...')

  // UserProfile
  for (const p of profile) {
    await pg.userProfile.upsert({
      where: { id: p.id },
      update: { name: p.name, gender: p.gender, birthday: p.birthday, height: p.height, goalWeight: p.goalWeight, goalDays: p.goalDays },
      create: { id: p.id, name: p.name, gender: p.gender, birthday: p.birthday, height: p.height, goalWeight: p.goalWeight, goalDays: p.goalDays },
    })
  }
  console.log(`  ✓ UserProfile`)

  // WeightLog
  for (const w of weightLogs) {
    await pg.weightLog.upsert({
      where: { date: w.date },
      update: { weight: w.weight },
      create: { date: w.date, weight: w.weight },
    })
  }
  console.log(`  ✓ WeightLog (${weightLogs.length})`)

  // FoodItem — track old id → new id for MealEntry foreign keys
  const foodIdMap = new Map<number, number>()
  for (const f of foodItems) {
    const existing = await pg.foodItem.findFirst({ where: { name: f.name } })
    if (existing) {
      foodIdMap.set(f.id, existing.id)
    } else {
      const created = await pg.foodItem.create({
        data: {
          name: f.name,
          category: f.category ?? null,
          servingUnit: f.servingUnit,
          servingAmount: f.servingAmount,
          kcalPerServing: f.kcalPerServing,
        },
      })
      foodIdMap.set(f.id, created.id)
    }
  }
  console.log(`  ✓ FoodItem (${foodItems.length})`)

  // MealEntry
  for (const m of mealEntries) {
    await pg.mealEntry.create({
      data: {
        date: m.date,
        mealType: m.mealType,
        foodId: m.foodId ? (foodIdMap.get(m.foodId) ?? null) : null,
        customName: m.customName ?? null,
        quantity: m.quantity,
        kcal: m.kcal,
      },
    })
  }
  console.log(`  ✓ MealEntry (${mealEntries.length})`)

  // DailyActivity
  for (const a of activities) {
    await pg.dailyActivity.upsert({
      where: { date: a.date },
      update: { exerciseKcal: a.exerciseKcal },
      create: { date: a.date, exerciseKcal: a.exerciseKcal },
    })
  }
  console.log(`  ✓ DailyActivity (${activities.length})`)

  console.log('\nMigration complete!')
  db.close()
  await pg.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
