const { readdirSync, writeFileSync } = require('fs')
const { basename, join, resolve } = require('path')
const request = require('sync-request')

const meta = require('../content/meta.json')
const meetups = require('../content/meetups.json')
const telegram = require('../content/telegram.json')
const soundboard = require('../content/soundboard.json')

const { TELEGRAM_BOT_TOKEN } = process.env

const dir = (...path) => resolve(__dirname, '..', ...path)
const writeJSON = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2))
const getTelegramMembersCount = url => {
  if (TELEGRAM_BOT_TOKEN) {
    if (url.startsWith('https://t.me/')) {
      [, , telegramId] = url.match(/:\/\/t\.me\/(?!(\+|joinchat))(.*)/) || []
      if (telegramId) {
        try {
          const jsonBody = request(
            'GET',
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMemberCount?chat_id=@${telegramId}`
          ).getBody('utf8')
          const { ok, result } = JSON.parse(jsonBody)
          if (ok) {
            return result
          }
        } catch (err) {}
      }
    }
  }
}

let recentBlocks = []
try {
  const jsonBody = request('GET', 'https://mempool.observer/api/recentBlocks').getBody('utf8')
  recentBlocks = JSON.parse(jsonBody)
} catch (err) {
  console.error('Could not load recent blocks:', err)
}

const block = recentBlocks.length && recentBlocks[0].height
const date = (new Date()).toJSON().split('T')[0]

// Telegram
const telegramData = telegram.map(t =>
  Object.assign(t, {
    members: getTelegramMembersCount(t.url),
  })
)

// Meetups
const meetupsData = meetups.map(m => Object.assign(m, {
  members: getTelegramMembersCount(m.url)
}))

writeJSON(dir('dist', 'meetups.json'), meetupsData)

writeJSON(dir('generated', 'site-data.json'), {
  date,
  block,
  meta,
  meetups: meetupsData,
  telegram: telegramData
})

// Soundboard
const sounds = soundboard.map(group => {
  group.sounds = group.sounds.map(sound => {
    sound.url = `https://einundzwanzig.space${sound.file}`
    delete sound.file
    return sound
  })
  return group
})

writeJSON(dir('dist', 'sounds.json'), sounds)

// Spendenregister
const spendenregisterDir = dir('content', 'spendenregister')
const spendenregister = readdirSync(spendenregisterDir).map(filename => {
  const filePath = join(spendenregisterDir, filename)
  const spende = require(filePath)
  spende.id = basename(filename, '.json')
  return spende
})

writeJSON(dir('generated', 'spendenregister.json'), spendenregister)
writeJSON(dir('dist', 'spendenregister.json'), spendenregister)
