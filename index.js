var express = require('express');
var app = express();
var cron = require('node-cron');
var configFileNameParam=process.argv[2] || "config";
var database = require('./database');
database.setAppConfig(configFileNameParam);
var bot=require('./telBot.js');
var telBotSysadmins=require('./telBotSysadmins');
var telBotAdmins=require('./telBotAdmins');
var msgManager=require('./msgManager.js');
var appConfig=database.getAppConfig();
var appPort=appConfig["appPort"]||80;
var logger=require('./logger.js')();

telBotSysadmins.sendAppStartMsgToSysadmins(appConfig, function(err){
    if(err) return;
    telBotAdmins.startSendingAdminMsgBySchedule(appConfig);
    telBotSysadmins.startSendingSysAdminMsgBySchedule(appConfig);
    //startSendingCashierMsgBySchedule();
    //startSendingSalesAndReturnsMsgBySchedule();
});
// function connectToDBRecursively(index, callingFuncMsg, callback){
//     database.connectToDB(function(err){
//         if(err && index<5){
//             setTimeout(function(){
//                 connectToDBRecursively(index+1,callingFuncMsg,callback);
//             },5000);
//         }else if(err && index==5){
//             telBotSysadmins.sendMsgToSysadmins("Не удалось подключиться к БД "+callingFuncMsg+ ". Причина:"+err);
//             if(callback)callback(err);
//         }else if(callback) callback();
//     });
// }

function startSendingCashierMsgBySchedule(){                                                                logger.info("startSendingCashierMsgBySchedule");
    var cashierSchedule=appConfig.cashierSchedule;
    if(!cashierSchedule||cron.validate(cashierSchedule)==false) return;
    var scheduleCashierMsg =cron.schedule(cashierSchedule,
        function(){
            sendCashierMsgBySchedule();
        });
    scheduleCashierMsg.start();
}
function startSendingSalesAndReturnsMsgBySchedule(){                                                           logger.info("startSendingSalesAndReturnsMsgBySchedule");
    var dailySalesRetSchedule=appConfig.dailySalesRetSchedule;
    if(!dailySalesRetSchedule||cron.validate(dailySalesRetSchedule)==false) return;
    var scheduleSalesAndReturnsMsg =cron.schedule(dailySalesRetSchedule,
        function(){
            sendSalesAndReturnsMsg();
        });
    scheduleSalesAndReturnsMsg.start();
};
function sendCashierMsgBySchedule(){
    database.getCashierDataArr(null,function(err, res){
        if(err){
            logger.error("Failed to get cashier array. Reason: "+err);
            if(err.name=="ConnectionError")   {
                connectToDBRecursively(0,"при попытке рассылки сообщений для кассиров",function(err){
                    if(!err){
                        sendCashierMsgBySchedule();
                    }
                });
            }
            return;
        }
        if(!res.recordset || res.recordset.length==0){
            logger.warn("No registered cashiers was found in DB.");
            return;
        }
        var cashierDataArr=res.recordset;
        msgManager.sendCashierMsgRecursively(0,cashierDataArr, true);
    });
}

function sendSalesAndReturnsMsg(){
    var dailySalesRetUsers=appConfig.dailySalesRetUsers;
    if(!dailySalesRetUsers || dailySalesRetUsers.length==0) return;
    database.getdailySalesRetUsersByPhone(dailySalesRetUsers, function(err,res){
        if(err) {
            logger.error("FAILED to get user chat ID for daily sales and returns msg. Reason: " + err);
            if (err.name == 'ConnectionError') {
                connectToDBRecursively(0, "при попытке рассылки сообщений о суммах продаж и возвратов ", function (err) {
                    if (!err) {
                        sendSalesAndReturnsMsg();
                    }
                });
            }
            return;
        }
        var adminChatArr=res;
        if(!adminChatArr || adminChatArr.length==0)return;
        msgManager.makeSalesAndReturnsMsg(function(err,adminMsg){
            if(err) {
                logger.error("Failed to make sales and returns msg. Reason: "+err.message?err.message:err);
                return;
            }
            for(var j in adminChatArr){
                logger.info("Daily sales and returns msg is sending to admin by schedule. Chat ID: "+adminChatArr[j].TChatID);
                bot.sendMsgToChatId(adminChatArr[j].TChatID, adminMsg, {parse_mode:"HTML"});
            }
        });
    });
}
app.listen(appPort);



