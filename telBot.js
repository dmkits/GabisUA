var Promise = require('bluebird');
var TelegramBot = require('node-telegram-bot-api');
var database=require('./database');
var logger=require('./logger')();
var configObj=database.getAppConfig();
var TOKEN=configObj['botToken'];
var bot = new TelegramBot(TOKEN, {polling: true});
var telBotSysadmins=require('./telBotSysadmins');
var telBotSalesReport=require('./telBotSalesReport');
var telBotAdmins=require('./telBotAdmins');
var telBotCashiers=require('./telBotCashiers');
var telBotRegistration=require('./telBotRegistration');
Promise.config({
    cancellation: true
});

telBotSysadmins.sendAppStartMsgToSysadmins(configObj);
telBotAdmins.startSendingAdminMsgBySchedule(configObj);
telBotSysadmins.startSendingSysAdminMsgBySchedule(configObj);
telBotCashiers.startSendingCashierMsgBySchedule(configObj);
telBotSalesReport.startSendingSalesAndReturnsMsgBySchedule(configObj);

var KB={
    registration:'Зарегистироваться',
    dbConnection:'Подключиться к БД'
};

bot.onText(/\/start/, function(msg, resp) {
    logger.info("New chat started. Greeting msg is sending. Chat ID: "+msg.chat.id);
    var chatID=msg.chat.id;
    bot.sendMessage(chatID, "Здравствуйте! \n Пожалуйста, зарегистрируйтесь для получения сообщений.", {
        reply_markup: {
            keyboard: [
                [{text:KB.registration , "request_contact": true}]
            ],
            one_time_keyboard: true
        }
    }).catch((error)=>{
            logger.warn("Failed to send msg to user. Chat ID:"+ chatID +" Reason: error.response.body=",error.response.body);
        });
});

bot.on('error', (error) => {
    logger.error("Bot ERROR=",error);
});

bot.on('polling_error', (error) => {
  logger.error(error);
});

bot.on('message',(msg)=>{
    if(msg.text==KB.dbConnection){
        database.connectToDB(function(err){
            if (err){
                telBotSysadmins.sendMsgToSysadmins("Не удалось подключиться к БД! Причина:"+err);
                return;
            }
            telBotSysadmins.sendMsgToSysadmins("Подключение к БД установлено успешно!");
        })
    }
    if(msg.contact && msg.contact.phone_number){
        var phoneNumber=msg.contact.phone_number;
        telBotRegistration.registerTelBotUser(phoneNumber,msg.chat.id);
    }
});
module.exports.sendMessage= function(chatId, text, form){
    bot.sendMessage(chatId, text, form).catch((error)=>{
        logger.warn("Failed to send msg to user. Chat ID:"+ chatId +" Reason: ",error.response.body);
    });
};