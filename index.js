var express = require('express');
var fs = require('fs');
var path = require('path');
var app = express();
var database = require('./database');
var cron = require('node-cron');
var moment = require('moment');
var msgManager=require('./msgManager.js');
var logger=require('./logger')();

var configFileNameParam=process.argv[2];

database.setAppConfig(configFileNameParam);
var bot=require('./telBot.js');

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
    if(!adminSchedule) adminSchedule='0 */2 * * * *';
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
var scheduleCashierMsg;
function startSendCashierMsgBySchedule(){                                                                 logger.info("startSendCashierMsgBySchedule");
    var serverConfig=database.getAppConfig();
    var cashierSchedule=serverConfig.cashierSchedule;                                                       logger.info("cashierSchedule=",cashierSchedule);
    if(!cashierSchedule) cashierSchedule='*/15 * * * * *';
    var valid = cron.validate(cashierSchedule);
    if(valid==false){                                                                                   logger.error("invalide cashierSchedule cron format "+adminSchedule);
        return;
    }
    if(scheduleCashierMsg)scheduleCashierMsg.destroy();
    scheduleCashierMsg =cron.schedule(cashierSchedule,
        function(){
            database.getCashierDataArr(function(err, res){
                if(err){
                    logger.error("Failed to get cashier array. Reason: "+err);
                    return;
                }
                if(!res.recordset || res.recordset.length==0){
                    logger.warn("No registered cashiers was found in DB.");
                    return;
                }
                var cashierDataArr=res.recordset;                         console.log("cashierDataArr=",cashierDataArr); console.log("cashierDataArr.length=",cashierDataArr.length);



                sendMsgRecursively(0,cashierDataArr);

                //for (var k in cashierDataArr){
                //    var stockID=cashierDataArr[k]["StockID"];
                //   // var TChatID=cashierDataArr[k]["TChatID"];
                //    var StockName=cashierDataArr[k]["StockName"];
                //    var CRName=cashierDataArr[k]["CRName"];
                //    var cashierMsg="";
                //
                //    database.getTRecByStockId(stockID, function(err, res){
                //        if(err){
                //            logger.error("Failed to get data from t_Rec by StockId. Reason: "+err);
                //            return;
                //        }
                //        if(res.recordset && res.recordset.length>0 ){   console.log("res.recordset.length=",res.recordset.length);
                //            cashierMsg+="\n<b>Числятся не подтвержденные приходные накладные:</b> ";
                //            cashierMsg+="\nКасса: "+ CRName +". Склад: "+StockName+".";
                //            var docListByStockId=res.recordset;              console.log("docListByStockId 115=",docListByStockId);
                //            for(var j in docListByStockId){
                //                cashierMsg += "\nНомер: "+docListByStockId[j]["DocID"] +" от "+docListByStockId[j]["DocDate"]+". ";
                //            }
                //            console.log("cashierMsg 119=",cashierMsg);
                //            if(cashierMsg) bot.sendMsgToChatId("491124507", cashierMsg, {parse_mode:"HTML"});
                //        }
                //    });
                //
                //}


               // console.log("getCashierDataArr res=",res);
            });

        });
    scheduleCashierMsg.start();
}
//startSendAdminMsgBySchedule();
//startSendSysAdminMsgBySchedule();
startSendCashierMsgBySchedule();
app.listen(8182);
 var countUnreg=0;
function sendMsgRecursively(index, cashierDataArr){
    if(!cashierDataArr[index]){
        console.log("ALL DONE");
        console.log("countUnreg=",countUnreg);
        return;
    }
    var cashierData=cashierDataArr[index];
    var stockID=cashierData["StockID"];    console.log(" sendMsgRecursively stockID 150=",stockID);
    // var TChatID=cashierDataArr[k]["TChatID"];
    var StockName=cashierData["StockName"];
    var CRName=cashierData["CRName"];
    var cashierMsg="";

    database.getTRecByStockId(stockID, function(err, res){
        if(err){
            logger.error("Failed to get data from t_Rec by StockId. Reason: "+err);
            return;
        }
        if(res.recordset && res.recordset.length>0 ){                       console.log("res.recordset.length=",res.recordset.length);
            cashierMsg+=stockID+"\n<b>Числятся не подтвержденные приходные накладные:</b> ";
            cashierMsg+="\nКасса: "+ CRName +". Склад: "+StockName+".";
            var docListByStockId=res.recordset;                             console.log("docListByStockId 115=",docListByStockId);
            for(var j in docListByStockId){
                cashierMsg += "\nНомер: "+docListByStockId[j]["DocID"] +" от "+docListByStockId[j]["DocDate"]+". ";
                countUnreg++;
            }
            console.log("cashierMsg 119=",cashierMsg);
            if(cashierMsg) bot.sendMsgToChatId("491124507", cashierMsg, {parse_mode:"HTML"});
            sendMsgRecursively(index+1,cashierDataArr);
        }else{
            sendMsgRecursively(index+1,cashierDataArr);
        }
    });
}

