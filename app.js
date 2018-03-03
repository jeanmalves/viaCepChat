require('dotenv-extended').load()

const builder = require('botbuilder')
const restify = require('restify')
const moment = require('moment')

// bot setup
const port = process.env.port || process.env.PORT || 3978
const server = restify.createServer()
server.listen(port, () => {
    console.log(`${server.name} listening to ${server.url}`)
})

const connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
})

const bot = new builder.UniversalBot(connector)
bot.set('storage', new builder.MemoryBotStorage())
server.post('/api/messages', connector.listen())

// Functions
function saudacao() {
  const split_afternoon = 12
  const split_evening = 18
  const currentHour = parseFloat(moment().utc().format('HH'))
  console.log(currentHour)
  if (currentHour >= split_afternoon && currentHour <= split_evening) {
    return 'Boa tarde'
  } else if (currentHour >= split_evening) {
    return 'Boa noite'
  }

  return 'Bom dia'
}

//LUIS Dialog
var luisAppId = process.env.LUIS_API_ID;
var luisAPIKey = process.env.LUIS_API_KEY;
var luisAPIHostName = process.env.LUIS_API_HOST_NAME || 'westus.api.cognitive.microsoft.com';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;

// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);

const intents = new builder.IntentDialog({
    recognizers: [recognizer]
})

intents.matches('saudar', (session, args, next) => {
  session.send(`${saudacao()}! Qual o tipo de consulta que será mais útil?`)
})

intents.matches('ajudar', (session, args, next) => {
  const message = 'Aqui você pode realizar consultas de endereços e CEP:\n\n' +
                  'Pesquisar um endereço: é necessário informar o CEP\n\n' +
                  'Pesquisar um CEP: é necessário informar o UF (estado), Cidade e Logradouro (rua)\n'
  session.send(message)
})

intents.matches('consciencia', (session, args, next) => {
  session.send('Eu sou famoso **CEP Bot**\n\nRealizo consultas de CEP e endereços.')
})

intents.matches('None', (session, args, next) => {
  session.send('Desculpe, mas não entendi o que você quis dizer.\n\nLembre-se que sou um bot, existem coisas que ainda não aprendi.')
})

intents.onDefault((session, args) => {
  session.send(`Desculpe, não pude compreender **${session.message.text}**\n\nLembre-se que sou um bot, existem coisas que ainda não aprendi.`)
})

bot.dialog('/', intents)