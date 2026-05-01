#!/usr/bin/env node
/**
 * Run: node generate-links.js
 * Or:  BASE_URL=https://yoursite.vercel.app node generate-links.js
 */
const guests = require('./data/guests.json')
const BASE_URL = process.env.BASE_URL || 'https://your-project.vercel.app'

console.log('\n🪷  Lahiru & Dushiya — Wedding Invite Links\n')
console.log('='.repeat(65))
Object.entries(guests).forEach(([code, g]) => {
  console.log(`\n👤  ${g.name}`)
  console.log(`    Contact: ${g.contactName} (${g.contactNumber})`)
  console.log(`    🔗  ${BASE_URL}/invite/${code}`)
})
console.log('\n' + '='.repeat(65))
console.log(`\nTotal guests: ${Object.keys(guests).length}\n`)
