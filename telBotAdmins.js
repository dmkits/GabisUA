var logger=require('./logger')();
var cron = require('node-cron');
var database = require('./database');
var bot=require('./telBot');
var moment = require('moment');

function startSendingAdminMsgBySchedule(appConfig){                                                              logger.info("startSendingAdminMsgBySchedule");
    var adminSchedule=appConfig.adminSchedule;
    if(!adminSchedule||cron.validate(adminSchedule)==false) return;
    var scheduleAdminMsg =cron.schedule(adminSchedule,
        function(){
            sendAdminMsgBySchedule();
        });
    scheduleAdminMsg.start();
}

module.exports.startSendingAdminMsgBySchedule=startSendingAdminMsgBySchedule;
function sendAdminMsgBySchedule(){
    database.getAdminChatIds(function(err, res){
        if(err){
            logger.error("FAILED to get admins chat ID. Reason: "+err);
            if(err.name=='ConnectionError')   {
                database.connectToDBRecursively(0, "при попытке рассылки сообщений для администраторов", function(err){
                    if(!err){
                        sendAdminMsgBySchedule();
                    }
                });
            }
            return;
        }
        var adminChatArr=res;
        makeUnconfirmedDocsMsg(function(err,adminMsg){
            if(err) {
                logger.error("Failed to make unconfirmed docs msg. Reasopn: "+err);
                return;
            }
            for(var j in adminChatArr){
                logger.info("Unconfirmed docs msg is sending to admin by schedule. Chat ID: "+adminChatArr[j].TChatID);
                bot.sendMessage(adminChatArr[j].TChatID, adminMsg, {parse_mode:"HTML"});
            }
        });
    });
}
function makeUnconfirmedDocsMsg (callback){
    var adminMsg='<b>Информация администратору на '+moment(new Date()).format('HH:mm DD.MM.YYYY')+' </b> \n';
    database.getTRecData(function(err, res){
        if(err){
            callback(err);
            return;
        }
        var tRecArr=res;
        if(tRecArr.length==0) {
            adminMsg+="\n<b>Все приходные накладные подтверждены.</b>";
            callback(null,adminMsg);
        }else{
            adminMsg+="<b>Неподтвержденные приходные накладные:</b> ";
            for (var i in tRecArr){
                var dataItem=tRecArr[i];
                adminMsg+="\n &#12539 "+dataItem.StockName+": "+dataItem.Total;
            }
        }
        database.getTExcData(function(err, res){
            if(err){
                callback(err);
                return;
            }
            var tExpArr=res;
            if(tExpArr.length==0) {
                adminMsg+="\n<b>Все  накладные перемещения подтверждены.</b>";
                callback(null,adminMsg);
                return;
            }
            adminMsg+="\n<b>Неподтвержденные накладные перемещения:</b>";
            for (var k in tExpArr){
                var dataItem=tExpArr[k];
                adminMsg+="\n &#12539 "+dataItem.StockName+": "+dataItem.Total;
            }
            callback(null,adminMsg);
        })
    });
};

module.exports.makeUnconfirmedDocsMsg=makeUnconfirmedDocsMsg;