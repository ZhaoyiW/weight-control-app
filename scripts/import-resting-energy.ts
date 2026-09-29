/**
 * Import historical resting-energy data from CSV (e.g. exported from Apple Health).
 *
 * Usage:
 *   npx tsx scripts/import-resting-energy.ts path/to/resting_energy.csv
 *
 * CSV format (header row required):
 *   date,resting_energy_kcal
 *
 * Accepts M/D/YY, M/D/YYYY, or YYYY-MM-DD dates. Upserts DailyActivity.restingKcal
 * per date, leaving any existing exerciseKcal for that date untouched.
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
  resting_energy_kcal: string
}

function normalizeDate(raw: string): string {
  if (raw.includes('/')) {
    const [m, d, yRaw] = raw.split('/')
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return raw // already YYYY-MM-DD
}

function parseCSV(filePath: string): Row[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const headers = lines[0].split(',').map(h => h.trim())

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])) as unknown as Row
  })
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: npx tsx scripts/import-resting-energy.ts path/to/resting_energy.csv')
    process.exit(1)
  }

  const rows = parseCSV(path.resolve(filePath))
  console.log(`Parsed ${rows.length} rows`)

  let upserted = 0
  let skipped = 0

  for (const row of rows) {
    const isoDate = normalizeDate(row.date)
    const kcal = Number(row.resting_energy_kcal)

    if (!isoDate || !row.resting_energy_kcal || isNaN(kcal)) {
      console.warn(`Skipping incomplete row: ${JSON.stringify(row)}`)
      skipped++
      continue
    }

    await prisma.dailyActivity.upsert({
      where: { date: isoDate },
      update: { restingKcal: kcal },
      create: { date: isoDate, exerciseKcal: 0, restingKcal: kcal },
    })
    upserted++
  }

  console.log(`Done — upserted ${upserted} days, skipped ${skipped}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
