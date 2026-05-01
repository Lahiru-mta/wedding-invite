#!/usr/bin/env node
/**
 * Add a new guest:
 *   node add-guest.js "Guest Name" "Contact Person" "+94771234567"
 *
 * Example:
 *   node add-guest.js "Dr. Perera" "Lahiru" "+94771234567"
 */

const fs = require('fs')
const path = require('path')

const [,, name, contactName, contactNumber] = process.argv

if (!name || !contactName || !contactNumber) {
  console.error('\nUsage: node add-guest.js "Guest Name" "Contact Person" "+94771234567"\n')
  process.exit(1)
}

const guestsPath = path.join(__dirname, 'data', 'guests.json')
const guests = JSON.parse(fs.readFileSync(guestsPath, 'utf8'))

const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
let code
do {
  code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
} while (guests[code])

guests[code] = { name, contactName, contactNumber }
fs.writeFileSync(guestsPath, JSON.stringify(guests, null, 2))

const BASE_URL = process.env.BASE_URL || 'https://your-project.vercel.app'
console.log(`\n✅  Added: ${name}`)
console.log(`👤  Contact: ${contactName} (${contactNumber})`)
console.log(`🔗  ${BASE_URL}/invite/${code}\n`)
