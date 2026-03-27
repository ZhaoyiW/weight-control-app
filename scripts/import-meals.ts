/**
 * Import historical meal data from CSV.
 *
 * Usage:
 *   npx tsx scripts/import-meals.ts path/to/meals.csv
 *
 * CSV format (header row required):
 *   date,mealType,foodName,kcal,servingUnit,servingAmount,kcalPerServing,quantity
 *
 * Library food  — leave kcal empty, fill servingUnit/servingAmount/kcalPerServing/quantity
 * Custom entry  — fill foodName + kcal, leave the rest blank
 *
 * Example:
 *   2025-01-01,breakfast,Oatmeal,,g,100,389,0.5
 *   2025-01-01,lunch,Home cooked stew,650,,,,
 */

import fs from 'fs'
import path from 'path'
import { PrismaClient } from '../app/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

interface Row {
  date: string
  mealType: string
  foodName: string
  kcal: string
  servingUnit: string
  servingAmount: string
  kcalPerServing: string
  quantity: string
}

function normalizeDate(raw: string): string {
  // Accept M/D/YYYY or MM/DD/YYYY → YYYY-MM-DD
  if (raw.includes('/')) {
    const [m, d, y] = raw.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return raw // already YYYY-MM-DD
}

function parseCSV(filePath: string): Row[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  // Only use the first 8 named headers, ignore trailing empty columns
  const allHeaders = lines[0].split(',').map(h => h.trim())
  const headers = allHeaders.slice(0, 8)

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])) as unknown as Row
  })
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: npx tsx scripts/import-meals.ts path/to/meals.csv')
    process.exit(1)
  }

  const rows = parseCSV(path.resolve(filePath))
  console.log(`Parsed ${rows.length} rows`)

  let created = 0
  let skipped = 0

  for (const row of rows) {
    const { date, mealType, foodName, kcal, servingUnit, servingAmount, kcalPerServing, quantity } = row

    const isoDate = normalizeDate(date)

    if (!isoDate || !mealType || !foodName) {
      console.warn(`Skipping incomplete row: ${JSON.stringify(row)}`)
      skipped++
      continue
    }

    const isCustom = kcal && !servingUnit && !kcalPerServing

    if (isCustom) {
      // Custom entry — store directly without food library
      await prisma.mealEntry.create({
        data: {
          date: isoDate,
          mealType,
          customName: foodName,
          quantity: 1,
          kcal: Math.round(Number(kcal)),
        },
      })
    } else {
      // Library entry — find or create FoodItem by name
      if (!servingUnit || !servingAmount || !kcalPerServing || !quantity) {
        console.warn(`Skipping row with missing serving info: ${JSON.stringify(row)}`)
        skipped++
        continue
      }

      let food = await prisma.foodItem.findFirst({ where: { name: foodName } })

      if (!food) {
        food = await prisma.foodItem.create({
          data: {
            name: foodName,
            servingUnit,
            servingAmount: Number(servingAmount),
            kcalPerServing: Number(kcalPerServing),
          },
        })
        console.log(`  Created food: ${foodName}`)
      }

      const entryKcal = (food.kcalPerServing / food.servingAmount) * Number(quantity)

      await prisma.mealEntry.create({
        data: {
          date: isoDate,
          mealType,
          foodId: food.id,
          quantity: Number(quantity),
          kcal: Math.round(entryKcal),
        },
      })
    }

    created++
  }

  console.log(`Done — imported ${created} entries, skipped ${skipped}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
