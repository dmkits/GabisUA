var Promise = require('bluebird');
var TelegramBot = require('node-telegram-bot-api');
var fs=require('fs');
var path = require('path');
//var TOKEN='491349310:AAG0qRPlpmJucU0hRZXzzwhlgo5yjt-zOjQ';
var TOKEN='464525746:AAFVhlT6jp5cgaS02vtCUHpD0-z6_5wb8j4';
var database=require('./database');

var bot = new TelegramBot(TOKEN, {polling: true});

var msgManager=require('./msgManager');

var KB={
    registration:'Зарегистироваться',
    dbConnection:'Подключиться к БД'
};

bot.onText(/\/start/, function(msg, resp) {
    bot.sendMessage(msg.chat.id, "Здравствуйте! \n Пожалуйста, зарегистрируйтесь для получения сообщений.", {
        reply_markup: {
            keyboard: [
                [{text:KB.registration , "request_contact": true}]
            ],
            one_time_keyboard: true
        }
    });
});

bot.on('polling_error', (error) => {
    console.log("polling_error=",error);
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
        database.checkPhoneAndWriteChatID(msg.contact.phone_number,msg.chat.id,
            function(err,status){
                if(err){
                    if(err.clientMsg){
                        bot.sendMessage(msg.chat.id, err.clientMsg);
                        checkAndRegisterSysAdmin(msg);
                        return;
                    }
                    checkAndRegisterSysAdmin(msg, true);
                    return;
                }
                bot.sendMessage(msg.chat.id, "Регистрация служащего для рассылки прошла успешно. Статус служащего: "+status+".");
                    msgManager.makeUnconfirmedDocsMsg(function(adminMsg){
                        if(!adminMsg){
                            console.log("FAIL! makeUnconfirmedDocsMsg!");
                            return;
                        }
                        setTimeout(function(){
                            bot.sendMessage(msg.chat.id, adminMsg, {parse_mode:"HTML"});
                            checkAndRegisterSysAdmin(msg);
                        },0);
                    });

            })
    }
});

module.exports.sendMsgToAdmins=function(msg, reconBut=true){   console.log("telBot sendMsgToAdmins");
    try{
        var admins = JSON.parse(fs.readFileSync(path.join(__dirname, './sysadmins.json')));

    }catch(e){
        console.log("error=",e);
        return;
    }
    for(var j in admins){
        var admin=admins[j];
        for(var h in admin){
        var adminChatId=admin[h];
            if(adminChatId){
                if(reconBut){
                    bot.sendMessage(adminChatId, msg,
                        {reply_markup: {
                            keyboard: [
                                [KB.dbConnection]
                            ],
                            one_time_keyboard: true
                        }
                        });
                    continue;
                }
                bot.sendMessage(adminChatId, msg,
                    {reply_markup: {
                        remove_keyboard: true
                    }
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
        }
    }
    for(var k in registeredSysAdmins){
        var registeredSysAdmin=registeredSysAdmins[k];
            if(registeredSysAdmin[phoneNumber]){
                bot.sendMessage(msg.chat.id, "Номер телефона пользователя Telegram уже зарегистрирован в справочнике системных администраторов.");
                    msgManager.makeDiskUsageMsg(null, function(adminMsg){
                        if(!adminMsg){
                          console.log("FAIL! Get makeDiskUsageMsg");
                            return;
                        }
                        setTimeout(function(){
                            bot.sendMessage(msg.chat.id, adminMsg);
                        },0);
                    });

                return;
            }
    }
    var configObj=database.getAppConfig();
    if(!configObj || !configObj["sysadmins"]) {
        return;
    }
    var sysAdminTelArr=configObj["sysadmins"];
    for(var i in sysAdminTelArr){
        var adminTelNum = sysAdminTelArr[i];
        if(adminTelNum==phoneNumber){
            var registeredSysAdmin={};
            registeredSysAdmin[adminTelNum]=msg.chat.id;
            registeredSysAdmins.push(registeredSysAdmin);
             fs.writeFile(path.join(__dirname, "./sysadmins.json"),JSON.stringify(registeredSysAdmins), {flag:'w+'},
                 function(err){
                     if (err) {
                         bot.sendMessage(msg.chat.id, "Ошибка регистрации системного администратора. "+err);
                         return;
                     }

                     bot.sendMessage(msg.chat.id, "Регистрация системного администратора прошла успешно.");
                          msgManager.makeDiskUsageMsg(null, function(adminMsg){
                              if(!adminMsg){
                                  console.log("FAIL! makeDiskUsageMsg");
                                  return;
                              }
                              setTimeout(function(){
                                  bot.sendMessage(msg.chat.id, adminMsg);
                              },0);
                     });
                 });
            return;
        }
        if(i==sysAdminTelArr.length-1){
            if(dbError) bot.sendMessage(msg.chat.id, "Не удалось зарегистрировать!\nПричина: номер телефона пользователя Telegram не найден в справочнике телефонов системных администраторов. " +
                "Другие справочники пользователей на данный момент недоступны.");
        }
    }
}

module.exports.sendMsgToChatId=function(chatId, msg, params={}){  console.log("telBot sendMsgToChatId");
    bot.sendMessage(chatId,msg, params);
};