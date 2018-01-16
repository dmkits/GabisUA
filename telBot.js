var Promise = require('bluebird');
var TelegramBot = require('node-telegram-bot-api');
var fs=require('fs');
var path = require('path');
//var TOKEN='491349310:AAG0qRPlpmJucU0hRZXzzwhlgo5yjt-zOjQ';
var TOKEN='464525746:AAFVhlT6jp5cgaS02vtCUHpD0-z6_5wb8j4';
var database=require('./database');
var logger=require('./logger')();
var bot = new TelegramBot(TOKEN, {polling: true});
var msgManager=require('./msgManager');

var KB={
    registration:'Зарегистироваться',
    dbConnection:'Подключиться к БД'
};

bot.onText(/\/start/, function(msg, resp) {
    logger.info("New chat started. Greeting msg is sending. Chat ID: "+msg.chat.id);
    bot.sendMessage(msg.chat.id, "Здравствуйте! \n Пожалуйста, зарегистрируйтесь для получения сообщений.", {
        reply_markup: {
            keyboard: [
                [{text:KB.registration , "request_contact": true}]
            ],
            one_time_keyboard: true
        }
    }).catch((error)=>{
            logger.warn("Failed to send msg to user. Chat ID:"+ msg.chat.id +" Reason: error.response.body=",error.response.body);
        });
});

bot.on('error', (error) => {
   console.log("EVENT error=",error);
});

bot.on('polling_error', (error) => {
  logger.error(error);
});

bot.on('message',(msg)=>{
    if(msg.text==KB.dbConnection){
        database.connectToDB(function(err){
            if (err){
                module.exports.sendMsgToAdmins("Не удалось подключиться к БД! Причина:"+err);
                return;
            }
             module.exports.sendMsgToAdmins("Подключение к БД установлено успешно!", false);
        })
    }
    if(msg.contact && msg.contact.phone_number){
        var dbConnectionError=database.getDbConnectionError();
        if(dbConnectionError){
            checkAndRegisterSysAdmin(msg, true);
            return;
        }
        var phoneNumber=msg.contact.phone_number;
        if(phoneNumber[0]=="+")phoneNumber=phoneNumber.substring(1);
        database.checkPhoneAndWriteChatID(phoneNumber,msg.chat.id,
            function(err,status){
                if(err){
                    if(err.clientMsg){
                        logger.error(err.clientMsg);
                        bot.sendMessage(msg.chat.id, err.clientMsg, {parse_mode:"HTML"}).catch((error)=>{
                            logger.warn("Failed to send msg to user. Chat ID:"+ msg.chat.id +" Reason:error.response.body=",error.response.body);
                        });
                        checkAndRegisterSysAdmin(msg);
                        return;
                    }
                    logger.error("Failed to check phone number and write chat ID. Reason: "+err);
                    checkAndRegisterSysAdmin(msg, true);
                    return;
                }
                logger.info("New user registered successfully as " +status+ ". Phone number: "+msg.contact.phone_number);
                bot.sendMessage(msg.chat.id, "Регистрация служащего для рассылки прошла успешно. Статус служащего: "+status+".").catch((error)=>{
                    logger.warn("Failed to send msg to user. Chat ID:"+ msg.chat.id +" Reason:error.response.body=",error.response.body);
                });
                    msgManager.makeUnconfirmedDocsMsg(function(err, adminMsg){
                        if(err){
                            logger.error("FAILED to make unconfirmed docs msg"+err);
                            return;
                        }
                        setTimeout(function(){
                            logger.info("Unconfirmed docs msg is sending. Phone number: "+msg.contact.phone_number);
                            bot.sendMessage(msg.chat.id, adminMsg, {parse_mode:"HTML"}).catch((error)=>{
                                logger.warn("Failed to send msg to user. Chat ID:"+ msg.chat.id +" Reason:error.response.body=",error.response.body);
                            });
                            checkAndRegisterSysAdmin(msg);
                        },0);
                    });
            })
    }
});

module.exports.sendMsgToAdmins=function(msg, reconBut=true){
    try{
        var admins = JSON.parse(fs.readFileSync(path.join(__dirname, './sysadmins.json')));
    }catch(e){
        logger.error("FAILED to get admin list. Reason: "+e);
        return;
    }
    for(var j in admins){
        var admin=admins[j];
        for(var h in admin){
        var adminChatId=admin[h];
            if(adminChatId){
                if(reconBut){
                    logger.warn("DB connection failed. Sending msg to sysadmin. Chat ID: "+adminChatId);
                    bot.sendMessage(adminChatId, msg,{parse_mode:"HTML"},
                        {reply_markup: {
                            keyboard: [
                                [KB.dbConnection]
                            ],
                            one_time_keyboard: true
                        }}).catch((error)=>{
                            logger.warn("Failed to send msg to user. Chat ID:"+ adminChatId +" Reason:error.response.body=",error.response.body);
                        });
                    continue;
                }
                logger.info("Sending msg to sysadmin by schedule. Chat ID: "+ adminChatId);
                bot.sendMessage(adminChatId, msg,{parse_mode:"HTML"}
                    ,{reply_markup: {
                        remove_keyboard: true
                    }}).catch((error)=>{
                        logger.warn("Failed to send msg to user. Chat ID:"+ adminChatId +" Reason:error.response.body=",error.response.body);
                    });
            }
        }
    }
};

function checkAndRegisterSysAdmin(msg, dbError=false){
    var phoneNumber=msg.contact.phone_number;
    var registeredSysAdmins;
    try{
        registeredSysAdmins=JSON.parse(fs.readFileSync(path.join(__dirname,"./sysadmins.json")));
    }catch(e){
        if (e.code == "ENOENT") {
            registeredSysAdmins =[];
        }else{
            logger.error("FAILED to get registeredSysAdmins list. Reason:"+e);
            return;
        }
    }
    for(var k in registeredSysAdmins){
        var registeredSysAdmin=registeredSysAdmins[k];
            if(registeredSysAdmin[phoneNumber]){
                logger.info("User is trying to register again as sysadmin. Msg is sending. Phone number: "+phoneNumber);
                bot.sendMessage(msg.chat.id, "Номер телефона пользователя Telegram уже зарегистрирован в справочнике системных администраторов.").catch((error)=>{
                    logger.warn("Failed to send msg to user. Chat ID:"+ msg.chat.id +" Reason:error.response.body=",error.response.body);
                });
                    msgManager.makeDiskUsageMsg(null, function(err, adminMsg){
                        if(err){
                          logger.error("FAILED to make disk usage msg. Reason: "+err);
                            return;
                        }
                        setTimeout(function(){
                            logger.info("Disk usage msg is sending for existed sysadmin. Phone number: "+phoneNumber);
                            bot.sendMessage(msg.chat.id, adminMsg, {parse_mode:"HTML"}).catch((error)=>{
                                logger.warn("Failed to send msg to user. Chat ID:"+ msg.chat.id +" Reason:error.response.body=",error.response.body);
                            });
                        },0);
                    });
                return;
            }
    }
    var configObj=database.getAppConfig();
    if(!configObj || !configObj["sysadmins"]) {
        return;
    }
    var sysAdminTelArr=configObj["sysadmins"];  console.log("sysAdminTelArr=",sysAdminTelArr);
    for(var i=0; i<sysAdminTelArr.length; i++){
        var adminTelNum = sysAdminTelArr[i];
        if(adminTelNum==phoneNumber){
            var registeredSysAdmin={};
            registeredSysAdmin[adminTelNum]=msg.chat.id;
            registeredSysAdmins.push(registeredSysAdmin);
             fs.writeFile(path.join(__dirname, "./sysadmins.json"),JSON.stringify(registeredSysAdmins), {flag:'w+'},
                 function(err){
                     if (err) {
                         logger.error("FAILED to register sysadmin. Reason: "+err);
                         bot.sendMessage(msg.chat.id, "Ошибка регистрации системного администратора. "+err).catch((error)=>{
                             logger.warn("Failed to send msg to user. Chat ID:"+ msg.chat.id +" Reason:error.response.body=",error.response.body);
                         });
                         return;
                     }
                     logger.info("New sysadmin registered successfully. Msg is sending.  Phone number: "+phoneNumber);
                     bot.sendMessage(msg.chat.id, "Регистрация системного администратора прошла успешно.").catch((error)=>{
                         logger.warn("Failed to send msg to user. Chat ID:"+ msg.chat.id +" Reason:error.response.body=",error.response.body);
                     });
                          msgManager.makeDiskUsageMsg(null, function(err, adminMsg){
                              if(err){
                                  logger.error("FAILED to make disk usage msg. Reason: "+err);
                                  return;
                              }
                              setTimeout(function(){
                                  logger.info("Disk usage msg is sending for new sysadmin.  Phone number: "+phoneNumber);
                                  bot.sendMessage(msg.chat.id, adminMsg, {parse_mode:"HTML"}).catch((error)=>{
                                      logger.warn("Failed to send msg to user. Chat ID:"+ msg.chat.id +" Reason:error.response.body=",error.response.body);
                                  });
                              },0);
                     });
                 });
            return;
        }
        if(i==sysAdminTelArr.length-1){
            logger.warn("Failed to register user! Msg is sending. Phone number: " + phoneNumber);
            if(dbError) bot.sendMessage(msg.chat.id, "Не удалось зарегистрировать!\nПричина: номер телефона пользователя Telegram не найден в справочнике телефонов системных администраторов. " +
                "Другие справочники пользователей на данный момент недоступны.").catch((error)=>{
                logger.warn("Failed to send msg to user. Chat ID:"+ msg.chat.id +" Reason:error.response.body=",error.response.body);
            });
        }
    }
}

module.exports.sendMsgToChatId=function(chatId, msg, params={}){
    bot.sendMessage(chatId,msg, params).catch((error)=>{
        logger.warn("Failed to send msg to user. Chat ID:"+ chatId +" Reason:error.response.body=",error.response.body);
    });
};
