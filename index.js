var express = require('express');
var fs = require('fs');
var path = require('path');
var app = express();
var database = require('./database');
var cron = require('node-cron');
var bot=require('./telBot.js');
var moment = require('moment');
var msgManager=require('./msgManager.js');


var configFileNameParam=process.argv[2];

database.setAppConfig(configFileNameParam);

database.connectToDB(function(err){
    if(err){
        bot.sendMsgToAdmins("Не удалось подключиться к БД! Причина:"+err);
    }
});

var scheduleSysAdminMsg;
function startSendSysAdminMsgBySchedule(){  console.log("index startSendSysAdminMsgBySchedule");
    var serverConfig=database.getAppConfig();                                       console.log("serverConfig=",serverConfig);
    var sysAdminSchedule=serverConfig.sysadminsSchedule;   console.log("sysAdminSchedule=",sysAdminSchedule);
    if(!sysAdminSchedule) sysAdminSchedule='*/15 * * * * *';
    var valid = cron.validate(sysAdminSchedule);
    if(valid==false){                                                                           console.log("invalide cron format");
        return;
    }
    var sysadminsMsgConfig = serverConfig.sysadminsMsgConfig;
    if(!sysadminsMsgConfig) return;
    if(scheduleSysAdminMsg)scheduleSysAdminMsg.destroy();
    scheduleSysAdminMsg =cron.schedule(sysAdminSchedule,
        function(){
            msgManager.makeDiskUsageMsg(sysadminsMsgConfig, function(adminMsg){
                if(!adminMsg){
                    console.log("FAIL! makeDiskUsageMsg");
                    return;
                }
                bot.sendMsgToAdmins(adminMsg, false);
            });

    });
    scheduleSysAdminMsg.start();
}

var scheduleAdminMsg;
function startSendAdminMsgBySchedule(){     console.log("index startSendAdminMsgBySchedule");
    var serverConfig=database.getAppConfig();
    var adminSchedule=serverConfig.adminSchedule;                            console.log("adminSchedule=",adminSchedule);
    if(!adminSchedule) adminSchedule='*/15 * * * * *';
    var valid = cron.validate(adminSchedule);
    if(valid==false){                                                                           console.log("invalide cron format");
        return;
    }
    if(scheduleAdminMsg)scheduleAdminMsg.destroy();
     scheduleAdminMsg =cron.schedule(adminSchedule,
         function(){
            msgManager.makeUnconfirmedDocsMsg(function(adminMsg){
                if(!adminMsg) {
                    console.log("FAIL!makeUnconfirmedDocsMsg");
                    return;
                }
                database.getAdminChatIds(function(err, res){
                    if(err){
                        console.log("err=",err);
                        return;
                    }
                    var adminChatArr=res;
                    for(var j in adminChatArr){
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
