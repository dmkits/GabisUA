var express = require('express');
var app = express();
var cron = require('node-cron');
var configFileNameParam=process.argv[2] || "config";
var database = require('./database');
database.setAppConfig(configFileNameParam);
var bot=require('./telBot.js');
var telBotSysadmins=require('./telBotSysadmins');
var msgManager=require('./msgManager.js');
var appConfig=database.getAppConfig();
var appPort=appConfig["appPort"]||80;
var logger=require('./logger.js')();

telBotSysadmins.sendAppStartMsgToSysadmins(appConfig, function(err){
    if(err) return;
   // startSendingAdminMsgBySchedule();
    telBotSysadmins.startSendingSysAdminMsgBySchedule(appConfig);
    //startSendingCashierMsgBySchedule();
    //startSendingSalesAndReturnsMsgBySchedule();
});
function connectToDBRecursively(index, callingFuncMsg, callback){
    database.connectToDB(function(err){
        if(err && index<5){
            setTimeout(function(){
                connectToDBRecursively(index+1,callingFuncMsg,callback);
            },5000);
        }else if(err && index==5){
            telBotSysadmins.sendMsgToSysadmins("Не удалось подключиться к БД "+callingFuncMsg+ ". Причина:"+err);
            if(callback)callback(err);
        }else if(callback) callback();
    });
}
// function startSendingSysAdminMsgBySchedule(){                                                          logger.info("startSendingSysAdminMsgBySchedule");
//     var sysAdminSchedule=appConfig.sysadminsSchedule;
//     var sysadminsMsgConfig = appConfig.sysadminsMsgConfig;
//     if(!sysAdminSchedule||cron.validate(sysAdminSchedule)==false||!sysadminsMsgConfig )return;
//     var scheduleSysAdminMsg =cron.schedule(sysAdminSchedule,
//         function(){
//             msgManager.makeDiskUsageMsg(sysadminsMsgConfig, function(err, adminMsg){
//                 if(err){
//                     logger.error("FAILED to make disk usage msg. Reason: "+err);
//                     return;
//                 }
//                 bot.sendMsgToSysadmins(adminMsg);
//             });
//     });
//     scheduleSysAdminMsg.start();
// }
function startSendingAdminMsgBySchedule(){                                                              logger.info("startSendingAdminMsgBySchedule");
    var adminSchedule=appConfig.adminSchedule;
    if(!adminSchedule||cron.validate(adminSchedule)==false) return;
     var scheduleAdminMsg =cron.schedule(adminSchedule,
         function(){
             sendAdminMsgBySchedule();
    });
    scheduleAdminMsg.start();
}
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
function sendAdminMsgBySchedule(){
    database.getAdminChatIds(function(err, res){
        if(err){
            logger.error("FAILED to get admins chat ID. Reason: "+err);
            if(err.name=='ConnectionError')   {
                connectToDBRecursively(0, "при попытке рассылки сообщений для администраторов", function(err){
                    if(!err){
                        sendAdminMsgBySchedule();
                    }
                });
            }
            return;
        }
        var adminChatArr=res;
        msgManager.makeUnconfirmedDocsMsg(function(err,adminMsg){
            if(err) {
                logger.error("Failed to make unconfirmed docs msg. Reasopn: "+err);
                return;
            }
            for(var j in adminChatArr){
                logger.info("Unconfirmed docs msg is sending to admin by schedule. Chat ID: "+adminChatArr[j].TChatID);
                bot.sendMsgToChatId(adminChatArr[j].TChatID, adminMsg, {parse_mode:"HTML"});
            }
        });
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



