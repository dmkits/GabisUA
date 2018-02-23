var database = require('./database');
var logger = require('./logger')();
var diskusage = require('diskusage-ng');
var fs = require('fs');
var path = require('path');
var bot=require('./telBot');
var cron = require('node-cron');
var moment = require('moment');
var configObj=database.getAppConfig();

function sendMsgToSysadmins(msg){                                                                                       logger.info("SENDING SYSADMIN MSG BY SCHEDULE...");
    database.getDbConnectionError(function(dbConnectionError){
        var reconBut=false;
        if(dbConnectionError)reconBut=true;
        try{
            var admins = JSON.parse(fs.readFileSync(path.join(__dirname, '../sysadmins.json')));                        logger.info(Object.keys(admins). length +" SYSADMINS WAS FOUND");
        }catch(e){
            logger.error("FAILED to get admin list. Reason: "+e);
            return;
        }
        sendMsgToSysadminsRecursively(0,admins,msg,reconBut);
    });
};

function sendMsgToSysadminsRecursively(index, sysadminsArray,msg,reconBut){
    if(!sysadminsArray[index]) return;
    var admin=sysadminsArray[index];
    for(var h in admin){
        var adminChatId=admin[h];
        if(!adminChatId) return;
        if(reconBut){
            logger.warn("DB connection failed. Sending msg to sysadmin. Chat ID: "+adminChatId);
            setTimeout(function () {
                bot.sendMessage(adminChatId, msg,
                    {parse_mode:"HTML",
                        reply_markup: {
                            keyboard: [
                                ['Подключиться к БД']
                            ]}
                    });
            },300);
            sendMsgToSysadminsRecursively(index+1, sysadminsArray,msg,reconBut);
            return;
        }
        logger.info("Sending msg to sysadmin. Chat ID: "+ adminChatId);
        setTimeout(function () {
            bot.sendMessage(adminChatId, msg, {parse_mode:"HTML", reply_markup: {remove_keyboard: true}});
            sendMsgToSysadminsRecursively(index+1, sysadminsArray,msg,reconBut);
        },300);
    }
}

module.exports.sendMsgToSysadmins=sendMsgToSysadmins;

function checkAndRegisterSysAdmin(phoneNumber,chatId, callback){
    var registeredSysAdmins;
    try{
        registeredSysAdmins=JSON.parse(fs.readFileSync(path.join(__dirname,"../sysadmins.json")));
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
            registeredSysAdmin[phoneNumber]=chatId;
            logger.info("Sysadmin registered successfully. Msg is sending.  Phone number: "+phoneNumber);
            bot.sendMessage(chatId, "Регистрация системного администратора прошла успешно.");
            makeDiskUsageMsg(null, function(err, adminMsg){
                if(err){
                    logger.error("FAILED to make disk usage msg. Reason: "+err);
                    return;
                }
                logger.info("Disk usage msg is sending for existed sysadmin. Phone number: "+phoneNumber);
                setTimeout(function () {
                    bot.sendMessage(chatId, adminMsg, {parse_mode:"HTML"});
                },500);
                callback(true);
            });
            return;
        }
    }
    var sysAdminTelArr =configObj.sysadmins;
    if(! sysAdminTelArr ||sysAdminTelArr.length==0) return;
    for(var i=0; i<sysAdminTelArr.length; i++){
        var adminTelNum = sysAdminTelArr[i];
        if(adminTelNum==phoneNumber){
            var registeredSysAdmin={};
            registeredSysAdmin[adminTelNum]=chatId;
            registeredSysAdmins.push(registeredSysAdmin);
            fs.writeFile(path.join(__dirname, "../sysadmins.json"),JSON.stringify(registeredSysAdmins), {flag:'w+'},
                function(err){
                    if (err) {
                        logger.error("FAILED to register sysadmin. Reason: "+err);
                        bot.sendMessage(chatId, "Ошибка регистрации системного администратора. "+err);
                        return;
                    }
                    logger.info("New sysadmin registered successfully. Msg is sending.  Phone number: "+phoneNumber);
                    bot.sendMessage(chatId, "Регистрация системного администратора прошла успешно.");
                    makeDiskUsageMsg(null, function(err, adminMsg){
                        if(err){
                            logger.error("FAILED to make disk usage msg. Reason: "+err);
                            return;
                        }
                        logger.info("Disk usage msg is sending for new sysadmin.  Phone number: " + phoneNumber);
                        setTimeout(function () {
                            bot.sendMessage(chatId, adminMsg, {parse_mode: "HTML"});
                        },300);
                    });
                    callback(true);
                });
            return;
        }
        if(i==sysAdminTelArr.length-1){
            callback();
        }
    }
}
module.exports.checkAndRegisterSysAdmin=checkAndRegisterSysAdmin;

function makeDiskUsageMsg(sysadminsMsgConfig, callback){
    var adminMsg='<b>Информация системному администратору на '+moment(new Date()).format('HH:mm DD.MM.YYYY')+' </b> \n';
    if(!sysadminsMsgConfig){
        var serverConfig=database.getAppConfig();
        var sysadminsMsgConfig = serverConfig.sysadminsMsgConfig;
        if(!sysadminsMsgConfig){
            callback ("FAIL! Reason: 'sysadminsMsgConfig' wasn't found in config params.");
            return;
        }
    }
    getDiscUsageInfo(sysadminsMsgConfig, function(err, diskSpase){
        if(err){
            adminMsg +='\n '+err;
        }
        if(diskSpase && diskSpase.system){
            adminMsg += "Ресурс: \n System: объем:"+diskSpase.system.total+"Гб, свободно:"+diskSpase.system.free+ "Гб ("+diskSpase.system.freePercent +"%).";
        }
        if(diskSpase && diskSpase.backup){
            adminMsg += "\n Ресурс: \n Backup: объем:"+diskSpase.backup.total+"Гб, свободно:"+diskSpase.backup.free+ "Гб ("+diskSpase.backup.freePercent +"%).";
        }
        getLastBackupFile(sysadminsMsgConfig, function(err,lastBackpupFile){
            if(err){
                adminMsg +='\n '+err;
            }
            if(lastBackpupFile && lastBackpupFile.backupDate && lastBackpupFile.fileName){
                adminMsg+="\n Последняя резервная копия БД "+ lastBackpupFile.fileName+" от " + moment(lastBackpupFile.backupDate).format("DD.MM.YYYY HH:mm:ss");
            }
            callback(null,adminMsg);
        })
    });
};

function getDiscUsageInfo(sysadminsMsgConfig, callback) {
    var system = sysadminsMsgConfig.system ? sysadminsMsgConfig.system.trim() : "";
    var backup = sysadminsMsgConfig.backup ? sysadminsMsgConfig.backup.trim() : "";
    var diskSpase = {};
    if(system){
        diskusage(system,function(err, info){
            if(err){
                callback(err);
                return;
            }
            diskSpase.system = {};
            diskSpase.system.total = parseInt(info.total/1073741824 );//parseInt (info.size / 1073741824);
            diskSpase.system.free = parseInt(info.available/1073741824 );// parseInt(info.available / 1073741824);
            diskSpase.system.freePercent = parseInt(diskSpase.system.free*100/diskSpase.system.total);
            if(backup){
                diskusage(backup,function(err,info ){
                    if(err){
                        callback(err);
                        return;
                    }
                    diskSpase.backup = {};
                    diskSpase.backup.total = parseInt(info.total/1073741824); // parseInt (info.size / 1073741824);
                    diskSpase.backup.free = parseInt(info.available/1073741824); //parseInt(info.available / 1073741824);
                    diskSpase.backup.freePercent = parseInt(diskSpase.backup.free*100/diskSpase.backup.total);
                    callback(null,diskSpase);
                });
                return;
            }
            callback(null,diskSpase);
        });
        return;
    }
    if(backup){
        diskusage(backup,function(err,info){
            if(err){
                callback(err);
                return;
            }
            diskSpase.backup = {};
            diskSpase.backup.total = parseInt(info.total/1073741824);
            diskSpase.backup.free = parseInt(info.available/1073741824);
            diskSpase.backup.freePercent = parseInt(diskSpase.backup.free*100/diskSpase.backup.total);
            callback(null,diskSpase);
        });
    }
}

function getLastBackupFile(sysadminsMsgConfig, callback){
    var backup = sysadminsMsgConfig.backup ? sysadminsMsgConfig.backup.trim() : "";
    if(!backup){
        callback("Не удалось найти путь к папке резервных коний БД.");
        return;
    }
    var backupFileName=sysadminsMsgConfig.dbBackupFileName ? sysadminsMsgConfig.dbBackupFileName.trim():"";
    if(!backupFileName){
        callback("Не удалось найти шаблон имени файла резервных коний БД.");
        return;
    }
    var backupFileNameTemplate=new RegExp("^"+backupFileName.substring(0,backupFileName.indexOf("*"))+".*\\"+backupFileName.substring(backupFileName.indexOf("*")+1)+"$");
    try{
        var files = fs.readdirSync(backup);
    }catch(e){
        callback(e);
        return;
    }
    var lastBackupFile={};
    lastBackupFile.backupDate=0;
    lastBackupFile.fileName="";
    for (var i in files){
        var stat = fs.statSync(path.join(backup+files[i]));
        if(files[i].match(backupFileNameTemplate)){
            if(stat.mtime>lastBackupFile.backupDate){
                lastBackupFile.backupDate=stat.mtime;
                lastBackupFile.fileName=files[i];
            }
        }
    }
    callback(null, lastBackupFile);
}

module.exports.sendAppStartMsgToSysadmins=function(appConfig){                                     logger.info("sendAppStartMsgToSysadmins");
    var msgStr="<b>Telegram bot started.</b>";
    msgStr=msgStr+"<b>\ndbHost:</b>"+appConfig["dbHost"];
    msgStr=msgStr+"<b>\ndbPort:</b>"+appConfig["dbPort"];
    msgStr=msgStr+"<b>\ndatabase:</b>"+appConfig["database"];
    msgStr=msgStr+"<b>\ndbUser:</b>"+appConfig["dbUser"];
    msgStr=msgStr+"<b>\nappPort:</b>"+appConfig["appPort"];
    if(appConfig["sysadminsMsgConfig"]) {
        msgStr=msgStr+"<b>\nsysadminsMsgConfig:</b>"+JSON.stringify(appConfig["sysadminsMsgConfig"]);
    }else msgStr=msgStr+"\n<b>sysadminsMsgConfig</b> NOT SPECIFIED";
    if(appConfig["sysadminsSchedule"]){                                                                      logger.info("sysadminsSchedule=",appConfig["sysadminsSchedule"]);
        msgStr=msgStr+"<b>\nsysadminsSchedule:</b>"+appConfig["sysadminsSchedule"];
        if(cron.validate(appConfig["sysadminsSchedule"])==false){                                            logger.error("sysadminsSchedule NOT VALID");
            msgStr=msgStr+" - NOT VALID";
        }else msgStr=msgStr+" - valid";
    } else msgStr=msgStr+"<b>\nsysadminsSchedule</b> NOT SPECIFIED";
    if(appConfig["adminSchedule"]){                                                                          logger.info("adminSchedule=",appConfig["adminSchedule"]);
        msgStr=msgStr+"<b>\nadminSchedule:</b>"+appConfig["adminSchedule"];
        if(cron.validate(appConfig["adminSchedule"])==false){                                                logger.error("adminSchedule NOT VALID");
            msgStr=msgStr+" - NOT VALID";
        }else msgStr=msgStr+" - valid";
    } else msgStr=msgStr+"<b>\nadminSchedule</b> NOT SPECIFIED";
    if(appConfig["dailySalesRetSchedule"]){                                                                  logger.info("dailySalesRetSchedule=",appConfig["dailySalesRetSchedule"]);
        msgStr=msgStr+"<b>\ndailySalesRetSchedule:</b>"+appConfig["dailySalesRetSchedule"];
        if(cron.validate(appConfig["dailySalesRetSchedule"])==false){                                        logger.error("dailySalesRetSchedule NOT VALID");
            msgStr=msgStr+" - NOT VALID";
        }else msgStr=msgStr+" - valid";
    } else msgStr=msgStr+"<b>\ndailySalesRetSchedule</b> NOT SPECIFIED";
    if(appConfig["cashierSchedule"]){                                                                        logger.info("cashierSchedule=",appConfig["cashierSchedule"]);
        msgStr=msgStr+"<b>\ncashierSchedule:</b>"+appConfig["cashierSchedule"];
        if(cron.validate(appConfig["cashierSchedule"])==false){                                              logger.error("cashierSchedule NOT VALID");
            msgStr=msgStr+" - NOT VALID";
        }else msgStr=msgStr+" - valid";
    } else msgStr=msgStr+"<b>\ncashierSchedule</b> NOT SPECIFIED";
    database.connectToDB(function(err){
        if (err){
            sendMsgToSysadmins(msgStr+"\n Failed to connect to database! Reason:"+err);
            return;
        }
        sendMsgToSysadmins(msgStr + "\n Connected to database successfully!");
    });
};

module.exports.startSendingSysAdminMsgBySchedule=function(appConfig){                                                          logger.info("startSendingSysAdminMsgBySchedule");
    var sysAdminSchedule=appConfig.sysadminsSchedule;
    var sysadminsMsgConfig = appConfig.sysadminsMsgConfig;
    if(!sysAdminSchedule||cron.validate(sysAdminSchedule)==false||!sysadminsMsgConfig )return;
    var scheduleSysAdminMsg =cron.schedule(sysAdminSchedule,
        function(){
            makeDiskUsageMsg(sysadminsMsgConfig, function(err, adminMsg){
                if(err){
                    logger.error("FAILED to make disk usage msg. Reason: "+err);
                    return;
                }
                sendMsgToSysadmins(adminMsg);
            });
        });
    scheduleSysAdminMsg.start();
}

