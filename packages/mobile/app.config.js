const { expo } = require('./app.json')

const fallbackApiUrl = 'http://localhost:3452/api'

module.exports = () => ({
  ...expo,
  extra: {
    ...expo.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL || expo.extra?.apiUrl || fallbackApiUrl,
  },
})
