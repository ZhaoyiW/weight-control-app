import { getSummariesInRange } from '@/lib/summaryRange'
import { NextRequest } from 'next/server'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/summary/range?from=YYYY-MM-DD&to=YYYY-MM-DD
// Daily summaries for every day in the range, most-recent-first.
export async function GET(request: NextRequest) {
  try {
    const from = request.nextUrl.searchParams.get('from') ?? ''
    const to = request.nextUrl.searchParams.get('to') ?? ''
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
      return Response.json({ error: 'from and to must be YYYY-MM-DD with from <= to' }, { status: 400 })
    }
    return Response.json(await getSummariesInRange(from, to))
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to fetch summaries' }, { status: 500 })
  }
}
