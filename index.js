var express = require('express');
var fs = require('fs');
var path = require('path');
var app = express();
var database = require('./database');
var cron = require('node-cron');
var bot=require('./telBot.js');
var moment = require('moment');
var msgManager=require('./msgManager.js');
var logger=require('./logger')();

var configFileNameParam=process.argv[2];

database.setAppConfig(configFileNameParam);

database.connectToDB(function(err){
    if(err){
        bot.sendMsgToAdmins("Не удалось подключиться к БД! Причина:"+err);
    }
});

var scheduleSysAdminMsg;
function startSendSysAdminMsgBySchedule(){                                                          logger.info("startSendSysAdminMsgBySchedule");
    var serverConfig=database.getAppConfig();
    var sysAdminSchedule=serverConfig.sysadminsSchedule;                                            logger.info("sysAdminSchedule=",sysAdminSchedule);
    if(!sysAdminSchedule) sysAdminSchedule='*/15 * * * * *';
    var valid = cron.validate(sysAdminSchedule);
    if(valid==false){                                                                               logger.error("invalide sysAdminSchedule cron format "+ sysAdminSchedule);
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
                bot.sendMsgToAdmins(adminMsg, false);
            });
    });
    scheduleSysAdminMsg.start();
}

var scheduleAdminMsg;
function startSendAdminMsgBySchedule(){                                                                 logger.info("startSendAdminMsgBySchedule");
    var serverConfig=database.getAppConfig();
    var adminSchedule=serverConfig.adminSchedule;                                                       logger.info("adminSchedule=",adminSchedule);
    if(!adminSchedule) adminSchedule='*/15 * * * * *';
    var valid = cron.validate(adminSchedule);
    if(valid==false){                                                                                   logger.error("invalide adminSchedule cron format "+adminSchedule);
        return;
    }
    if(scheduleAdminMsg)scheduleAdminMsg.destroy();
     scheduleAdminMsg =cron.schedule(adminSchedule,
         function(){
            msgManager.makeUnconfirmedDocsMsg(function(err,adminMsg){
                if(err) {
                    logger.error("Failed to make unconfirmed docs msg. Reasopn: "+err);
                    return;
                }
                database.getAdminChatIds(function(err, res){
                    if(err){
                        logger.error("FAILED to get admins chat ID. Reason: "+err);
                        return;
                    }
                    var adminChatArr=res;
                    for(var j in adminChatArr){
                        logger.info("Unconfirmed docs msg is sending to admin by schedule. Chat ID: "+adminChatArr[j].TChatID);
                        bot.sendMsgToChatId(adminChatArr[j].TChatID, adminMsg, {parse_mode:"HTML"});
                    }
                });
            });
    });
    scheduleAdminMsg.start();
}
startSendAdminMsgBySchedule();
startSendSysAdminMsgBySchedule();
app.listen(8182);
