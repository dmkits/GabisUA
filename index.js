var express = require('express');
var fs = require('fs');
var path = require('path');
var app = express();
var cron = require('node-cron');
var moment = require('moment');
var logger=require('./logger')();

var configFileNameParam=process.argv[2] || "config";
var waitingFunctions={};
var database = require('./database');

database.setAppConfig(configFileNameParam);
var bot=require('./telBot.js');
var msgManager=require('./msgManager.js');

module.exports.executeWaitingFunctions=function(){
  var waitingFuncNames=Object.keys(waitingFunctions);
  if(waitingFuncNames.length>0){
      for (var f in waitingFuncNames){
          waitingFunctions[waitingFuncNames[f]]();
      }
  }
};

connectToDBRecursively(0,"при старте приложения",function(){
    startSendingAdminMsgBySchedule();
    startSendingSysAdminMsgBySchedule();
    startSendingCashierMsgBySchedule();
});

function connectToDBRecursively(index, callingFuncMsg, callback){
    database.connectToDB(function(err){
        if(err && index<5){
            setTimeout(function(){
                connectToDBRecursively(index+1,callingFuncMsg,callback);
            },1000);
        }else if(err && index==5){
            bot.sendMsgToAdmins("Не удалось подключиться к БД "+callingFuncMsg+ ". Причина:"+err);
            if(callback)callback(err);
        }else if(callback) callback();
    });
}

var scheduleSysAdminMsg;
function startSendingSysAdminMsgBySchedule(){                                                          logger.info("startSendingSysAdminMsgBySchedule");
    var serverConfig=database.getAppConfig();
    var sysAdminSchedule=serverConfig.sysadminsSchedule;                                               logger.info("sysAdminSchedule=",sysAdminSchedule);
    if(!sysAdminSchedule) sysAdminSchedule='*/15 * * * * *';
    var valid = cron.validate(sysAdminSchedule);
    if(valid==false){                                                                                 logger.error("invalide sysAdminSchedule cron format "+ sysAdminSchedule);
        return;
    }
    var sysadminsMsgConfig = serverConfig.sysadminsMsgConfig;
    if(!sysadminsMsgConfig) return;
    if(scheduleSysAdminMsg)scheduleSysAdminMsg.destroy();
    scheduleSysAdminMsg =cron.schedule(sysAdminSchedule,
        function(){
            msgManager.makeDiskUsageMsg(sysadminsMsgConfig, function(err, adminMsg){
                if(err){
                    logger.error("FAILED to make disk usage msg. Reason: "+err);
                    return;
                }
                bot.sendMsgToAdmins(adminMsg);
            });
    });
    scheduleSysAdminMsg.start();
}

var scheduleAdminMsg;
function startSendingAdminMsgBySchedule(){                                                              logger.info("startSendingAdminMsgBySchedule");
    var serverConfig=database.getAppConfig();
    var adminSchedule=serverConfig.adminSchedule;                                                       logger.info("adminSchedule=",adminSchedule);
    if(!adminSchedule) adminSchedule='0 */2 * * * *';
    var valid = cron.validate(adminSchedule);
    if(valid==false){                                                                                   logger.error("invalide adminSchedule cron format "+adminSchedule);
        return;
    }
    if(scheduleAdminMsg)scheduleAdminMsg.destroy();
     scheduleAdminMsg =cron.schedule(adminSchedule,
         function(){
             sendAdminMsgBySchedule();
    });
    scheduleAdminMsg.start();
}
var scheduleCashierMsg;
function startSendingCashierMsgBySchedule(){                                                                logger.info("startSendingCashierMsgBySchedule");
    var serverConfig=database.getAppConfig();
    var cashierSchedule=serverConfig.cashierSchedule;                                                       logger.info("cashierSchedule=",cashierSchedule);
    if(!cashierSchedule) cashierSchedule='*/15 * * * * *';
    var valid = cron.validate(cashierSchedule);
    if(valid==false){                                                                                       logger.error("invalide cashierSchedule cron format "+adminSchedule);
        return;
    }
    if(scheduleCashierMsg)scheduleCashierMsg.destroy();
    scheduleCashierMsg =cron.schedule(cashierSchedule,
        function(){
            sendCashierMsgBySchedule();
        });
    scheduleCashierMsg.start();
}

function sendCashierMsgBySchedule(){
    database.getCashierDataArr(null,function(err, res){
        if(err){
            logger.error("Failed to get cashier array. Reason: "+err);
            if(err.name=="ConnectionError")   {
                connectToDBRecursively(0,"при попытке рассылки сообщений для кассиров",function(err){
                    if(err){
                        waitingFunctions.sendCashierMsgBySchedule=function(){
                            sendCashierMsgBySchedule();
                        };
                        return;
                    }
                    sendCashierMsgBySchedule();
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
                    if(err){
                        waitingFunctions.sendAdminMsgBySchedule=function(){
                            sendAdminMsgBySchedule();
                        };
                        return;
                    }
                    sendAdminMsgBySchedule();
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
app.listen(8182);



