var Promise = require('bluebird');
var TelegramBot = require('node-telegram-bot-api');
var fs=require('fs');
var path = require('path');
var TOKEN='491349310:AAG0qRPlpmJucU0hRZXzzwhlgo5yjt-zOjQ';
var database=require('./database');

var bot = new TelegramBot(TOKEN, {polling: true});



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
                module.exports.sendMsgToAdmins("Невозможно подключиться к БД! Причина:"+err);
                return;
            }
             module.exports.sendMsgToAdmins("Подключение к БД установлено успешно!", false);
        })
    }
    if(msg.contact && msg.contact.phone_number) checkAndRegisterSysAdmin(msg);
});


module.exports.sendMsgToAdmins=function(msg, reconBut=true){                    console.log("sendMsgToAdmins");
    try{
        var admins = JSON.parse(fs.readFileSync(path.join(__dirname, './sysadmins.json')));
        console.log("admins=",admins);
    }catch(e){
        console.log("error=",e);
        return;
    }
    for(var j in admins){           console.log("inside for");
        var admin=admins[j];       console.log("admin=",admin);
        for(var h in admin){
        var adminChatId=admin[h];   console.log("adminChatId=",adminChatId);
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
                    return;
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

function checkAndRegisterSysAdmin(msg){
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
                bot.sendMessage(msg.chat.id, "Данный номер телефона уже зарегистрирован!");
                    return;
            }
        }

    try {
        var configObj = JSON.parse(fs.readFileSync(path.join(__dirname, './config.json'))); console.log("configObj=",configObj);
    }catch(e){
        return;
    }
    if(!configObj || !configObj["sysadmins"]) {                                              console.log("No sysadmin phone numbers");
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
                         bot.sendMessage(msg.chat.id, "Ошибка регистрации! "+err);
                         return;
                     }
                     bot.sendMessage(msg.chat.id, "Регистрация прошла успешно!");
                 });
            return;
        }
        if(i==sysAdminTelArr.length-1){
            bot.sendMessage(msg.chat.id, "Невозможно зарегистрировать!\nПричина: данный номер телефона не найден в списке телефонов администраторов!");
        }
    }
}