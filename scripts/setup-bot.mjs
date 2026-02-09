const TOKEN = '7579656533:AAHlGxCm2kRRtjauanKvxpEfNY9KV6LmCdo'
const API = `https://api.telegram.org/bot${TOKEN}`

async function setup() {
  // Set description
  let res = await fetch(`${API}/setMyDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'Jens Construction Platform Bot. Project management, cost estimation, n8n workflow status, CAD file conversion and notifications.'
    })
  })
  console.log('setMyDescription:', (await res.json()).ok)

  // Set short description
  res = await fetch(`${API}/setMyShortDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      short_description: 'Jens Platform - Construction Management & n8n Automation'
    })
  })
  console.log('setMyShortDescription:', (await res.json()).ok)

  // Set commands
  res = await fetch(`${API}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Start bot & show welcome message' },
        { command: 'help', description: 'List all commands' },
        { command: 'status', description: 'n8n & platform status' },
        { command: 'workflows', description: 'List n8n workflows' },
        { command: 'estimate', description: 'Quick cost estimate (CWICR)' },
        { command: 'tasks', description: 'View project tasks' },
        { command: 'convert', description: 'CAD file conversion info' },
        { command: 'health', description: 'System health check' },
      ]
    })
  })
  console.log('setMyCommands:', (await res.json()).ok)

  // Set bot name
  res = await fetch(`${API}/setMyName`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Jens Platform' })
  })
  console.log('setMyName:', (await res.json()).ok)
}

setup()
