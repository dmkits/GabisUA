var Promise = require('bluebird');
var TelegramBot = require('node-telegram-bot-api');
var fs=require('fs');
var path = require('path');
var TOKEN='538609929:AAFJMXsK_ePiZ4zbEe_pkqvPGTgs28JQ1eY';
var database=require('./database');

var bot = new TelegramBot(TOKEN, {polling: true});


try {
    var adminPhoneNumArr = JSON.parse(fs.readFileSync(path.join(__dirname, './adminPhoneNums.json')));
}catch(e){
    console.log("err 8=",e);
    return;
}


bot.onText(/\/start/, function(msg, resp) {  console.log("msg 18=",msg);console.log("resp 18=",resp);
    bot.sendMessage(msg.chat.id, "Hello! \n Please, register for receiving messages.", {
        reply_markup: {
            keyboard: [
                [{text: "Register", "request_contact": true}]
            ],
            one_time_keyboard: true
        }
    });
});

bot.on('polling_error', (error) => {
    console.log("polling_error=",error);
});

bot.on('message',(msg)=>{                                        console.log("msg 31=",msg);
    var instance=this;
    if(msg.text=="Reconnect to database"){
        database.connectToDB(function(err){
            if (err){
                instance.sendMsgToAdmins("Database connection error occured! Reason"+err);
            }
        })
    };
    if(!msg.contact || !msg.contact.phone_number) return;
    var phoneNumber=msg.contact.phone_number;                     console.log("phoneNumber=",phoneNumber);
    var admins;
    try {
        admins = JSON.parse(fs.readFileSync(path.join(__dirname, './adminPhoneNums.json')));   console.log("admins=",admins);
    }catch(e){
        console.log("admins parse error 51=",e);
        return;
    }

    for(var k=0; k<admins.length; k++){
        var admin=admins[k];                                console.log("admin=",admin,admin.tel,admin.chatId);
        if(admin.tel==phoneNumber && !admin.chatId) {      console.log("admins[i].t6el==phoneNumber 78cl=", admins[k].tel);
            admin.chatId = msg.chat.id;
            try {
                fs.writeFileSync(path.join(__dirname, './adminPhoneNums.json'), JSON.stringify(admins));
            } catch (e) {
                console.log("ERROR 52=", e);
                return;
            }
            bot.sendMessage(msg.chat.id, "Congratulations!\n You have registered as admin successfully!");
            database.connectToDB(function(err){
                if (err){
                    instance.sendMsgToAdmins("Database connection error occured! Reason"+err);
                }
            });
        }else if(admin.tel==phoneNumber && admin.chatId) {
            bot.sendMessage(msg.chat.id, "You are already registered as admin!");
            database.connectToDB(function(err){
                if (err){
                    instance.sendMsgToAdmins("Database connection error occured! Reason"+err);
                }
            });
        }
    }
});

module.exports.sendMsgToAdmins=function(msg){
    var admins = JSON.parse(fs.readFileSync(path.join(__dirname, './adminPhoneNums.json')));
    var totalMsg=0;
    for(var j in admins){
        var adminChatId=admins[j].chatId;
        if(adminChatId){
            bot.sendMessage(adminChatId, msg,
                {reply_markup: {
                        keyboard: [
                            ["Reconnect to database"]
                        ],
                        one_time_keyboard: true
                    }
                });
            totalMsg++;
        }
    }
    if(totalMsg==0) console.log("No registered admins");
};