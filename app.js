require('dotenv-extended').load()

const builder = require('botbuilder')
const formflowbotbuilder = require('formflowbotbuilder')
const restify = require('restify')
const request = require('request')
const moment = require('moment')
const path = require('path')

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

//FormFlow
const dialogName = 'form'
const formData = path.join(__dirname, 'formData.json')
formflowbotbuilder.executeFormFlow(formData, bot, dialogName, (err, responses) => {
  if(err)
      return console.log(err)
  bot.dialog('endereco', [
    (session) => {
      session.beginDialog(dialogName)
    },
    (session, results) => {
        const questao = `Está correto?\n`
                      + `* Estado: ${responses.uf}\n` 
                      + `* Cidade: ${responses.cidade}\n`
                      + `* Rua: ${responses.rua}\n`
          const options = {
              listStyle: builder.ListStyle.button,
              retryPrompt: 'Deculpa, não entendi, selecione uma das opções'
          }
          builder.Prompts.confirm(session, questao, options)
    },
    (session, results) => {
          if(results.response){
              session.send('Aguarde um pouco enquanto eu procuro...');

              const endpoint = `${process.env.NODEJS_CEP_API}/address/${responses.uf}/${responses.cidade}/${responses.rua}`;
              console.log(endpoint);
              request(endpoint, (error, response, body) => {
                  if(error || !body)
                      return session.send('Ocorreu algum erro, tente novamente mais tarde.')
                  const endereco = JSON.parse(body);
                  var message = '';

                  for(var i = 0; i < endereco.length; i++) {
                    message += 'Cep:' + endereco[i].cep + '\n\n' +
                    'Rua:' + endereco[i].logradouro + '\n\n' +
                    'Bairro:' + endereco[i].bairro + '\n\n' +
                    'Cidade:' + endereco[i].localidade + '\n\n' +
                    'Estado:' + endereco[i].uf + '\n\n' + 
                    '---------------------------------------\n\n';
                  }
                  if (message != null) {
                    session.send('Ai está o endereço que precisa');
                    session.endDialog(message);
                  } else {
                    session.endDialog('Não consegui encontrar nada com as informações que me passou, você pode tentar de novo quando quiser.');
                  }
              })

              return;
          }
          session.userData.reload = true;
          session.send('Tudo bem, vamos tentar novamente')
          session.replaceDialog('endereco')
      }
  ])
})

// Intents
intents.matches('saudar', (session, args, next) => {
  session.send(
    `${saudacao()}! Eu sou o Pablo, ajudo as pessoas fazendo consultas de CEP's e endereços, como posso te ajudar?`
  )
})

intents.matches('ajudar', (session, args, next) => {
  const message = 'Aqui você pode realizar consultas de endereços e CEP:\n\n' +
                  'Pesquisar um endereço: é necessário informar o CEP\n\n' +
                  'Pesquisar um CEP: é necessário informar o UF (estado), Cidade e Logradouro (rua)\n'
  session.send(message)
})

intents.matches('consciencia', (session, args, next) => {
  session.send('Eu sou um bot e me chamo Pablo\n\nRealizo consultas de CEP e endereços.')
})

intents.matches('None', (session, args, next) => {
  session.send('Desculpe, mas não entendi o que você quis dizer.\n\nLembre-se que sou um bot, existem coisas que ainda não aprendi.')
})

intents.matches('consulta-por-cep', (session, args, next) => {
  const cep = builder.EntityRecognizer.findEntity(args.entities, 'CEP');

  if(cep && cep.entity && !!cep.entity.length) {
    session.send(`Aguarde um pouco enquanto eu procuro o endereço do cep **${cep.entity}**`);
    const endpoint = `${process.env.NODEJS_CEP_API}/cep/${cep.entity}`;

    request(endpoint, (error, response, body) => {
        if(error || !body)
            return session.send('Ocorreu algum erro, tente novamente mais tarde.')
        const endereco = JSON.parse(body);

        session.send('Ai está o endereço que precisa');

        const message = 'Cep:' + endereco.cep + '\n\n' +
                        'Rua:' + endereco.logradouro + '\n\n' +
                        'Bairro:' + endereco.bairro + '\n\n' +
                        'Cidade:' + endereco.localidade + '\n\n' +
                        'Estado:' + endereco.uf + '\n\n';
        
        session.send(message);
    })
  } else {
      session.send('**(ಥ﹏ಥ)** - Foi mal, não encontrei nada parecido, verifique se este CEP existe ou está desatualizado...');
  }
})

intents.matches('consulta-por-endereco', (session, args, next) => {
  const endereco = builder.EntityRecognizer.findEntity(args.entities, 'endereco');

  if (endereco && endereco.entity && !!endereco.entity.length) {
    session.send(`Ok, para eu poder procurar o endereço **${endereco.entity}** vou precisar de algumas informações...`);
  } else {
    session.send(`Ok, para eu poder procurar o endereço que me pediu vou precisar de algumas informações...`);
  }

  session.beginDialog('endereco');
})

intents.onDefault((session, args) => {
  session.send(`Desculpe, não pude compreender **${session.message.text}**\n\nLembre-se que sou um bot, existem coisas que ainda não aprendi.`)
})

// Quando entrar um usuário novo diferente do bot
bot.on('conversationUpdate', (update) => {
  if (update.membersAdded) {
      update.membersAdded.forEach( (identity) => {
          if (identity.id === update.address.bot.id) {
              bot.loadSession(update.address, (err, session) => {
                  if(err)
                      return err
                  const message = 'Olá, eu sou o **Bot Pablo**. Olha só, o que eu posso fazer pra você:\n' +
                  '* **Buscar endereços**\n' +
                  '* **Buscar CEP**\n'
                  session.send(message)
              })
          }
      })
  }
})

bot.dialog('/', intents)