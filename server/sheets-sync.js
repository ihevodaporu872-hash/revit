// ============================================================================
// Google Sheets Sync — Jens Platform
// ============================================================================
// Syncs tasks and field reports from Supabase to Google Sheets
// for manager access. Uses Google Sheets API v4.
// ============================================================================

/**
 * Initialize Google Sheets sync module.
 * @param {object} deps — { supabase }
 * @returns {object} sync API
 */
export function createSheetsSync({ supabase }) {
  const SHEETS_ID = process.env.GOOGLE_SHEETS_ID || ''
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || ''

  // Auto-sync interval (null if not started)
  let syncInterval = null

  /**
   * Append rows to a Google Sheet using API key auth.
   * @param {string} sheetName — tab name (e.g. 'Tasks', 'Reports')
   * @param {Array<Array<string>>} rows — 2D array of values
   */
  async function appendToSheet(sheetName, rows) {
    if (!SHEETS_ID || !GOOGLE_API_KEY) {
      console.warn('[Sheets] Google Sheets not configured (GOOGLE_SHEETS_ID or GOOGLE_API_KEY missing)')
      return null
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&key=${GOOGLE_API_KEY}`

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows }),
      })

      if (!res.ok) {
        const text = await res.text()
        console.error(`[Sheets] Append failed (${res.status}):`, text)
        return null
      }

      const data = await res.json()
      console.log(`[Sheets] Appended ${rows.length} rows to "${sheetName}"`)
      return data
    } catch (err) {
      console.error('[Sheets] Append error:', err.message)
      return null
    }
  }

  /**
   * Clear a sheet and write fresh data.
   * @param {string} sheetName
   * @param {Array<Array<string>>} rows — including header row
   */
  async function overwriteSheet(sheetName, rows) {
    if (!SHEETS_ID || !GOOGLE_API_KEY) return null

    const range = `${sheetName}!A1`
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED&key=${GOOGLE_API_KEY}`

    try {
      // Clear first
      const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/${encodeURIComponent(sheetName)}:clear?key=${GOOGLE_API_KEY}`
      await fetch(clearUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })

      // Write
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows }),
      })

      if (!res.ok) {
        console.error(`[Sheets] Write failed (${res.status})`)
        return null
      }

      console.log(`[Sheets] Wrote ${rows.length} rows to "${sheetName}"`)
      return await res.json()
    } catch (err) {
      console.error('[Sheets] Write error:', err.message)
      return null
    }
  }

  /**
   * Sync tasks from Supabase to Google Sheet.
   */
  async function syncTasks() {
    if (!supabase || !SHEETS_ID) return

    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error || !tasks) return

      const header = ['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Due Date', 'Object', 'Section', 'Report Status', 'Report Comment', 'Created']
      const rows = tasks.map(t => [
        t.id,
        t.title || '',
        t.status || '',
        t.priority || '',
        t.assignee || '',
        t.due_date || '',
        t.object || '',
        t.section || '',
        t.report_status || '',
        t.report_comment || '',
        t.created_at || '',
      ])

      await overwriteSheet('Tasks', [header, ...rows])
    } catch (err) {
      console.error('[Sheets] Tasks sync error:', err.message)
    }
  }

  /**
   * Sync field reports from Supabase to Google Sheet.
   */
  async function syncReports() {
    if (!supabase || !SHEETS_ID) return

    try {
      const { data: reports, error } = await supabase
        .from('field_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error || !reports) return

      const header = ['ID', 'Task ID', 'Reporter', 'Type', 'Status', 'GPS', 'Photos', 'Read', 'Created']
      const rows = reports.map(r => [
        r.id,
        r.task_id || '',
        r.reporter || '',
        r.report_type || '',
        r.processing_status || '',
        r.gps_coordinates || '',
        r.photo_count || 0,
        r.reminder_read ? 'Yes' : 'No',
        r.created_at || '',
      ])

      await overwriteSheet('Reports', [header, ...rows])
    } catch (err) {
      console.error('[Sheets] Reports sync error:', err.message)
    }
  }

  /**
   * Run full sync (tasks + reports).
   */
  async function syncAll() {
    await Promise.all([syncTasks(), syncReports()])
  }

  /**
   * Start automatic sync at given interval.
   * @param {number} intervalMs — default 5 minutes
   */
  function startAutoSync(intervalMs = 5 * 60 * 1000) {
    if (!SHEETS_ID) {
      console.log('[Sheets] Auto-sync disabled (no GOOGLE_SHEETS_ID)')
      return
    }

    stopAutoSync()
    syncAll()
    syncInterval = setInterval(syncAll, intervalMs)
    console.log(`[Sheets] Auto-sync started (every ${intervalMs / 1000}s)`)
  }

  /**
   * Stop automatic sync.
   */
  function stopAutoSync() {
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
    }
  }

  return {
    appendToSheet,
    overwriteSheet,
    syncTasks,
    syncReports,
    syncAll,
    startAutoSync,
    stopAutoSync,
  }
}
