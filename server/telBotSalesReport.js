var logger=require('./logger')();
var cron = require('node-cron');
var database = require('./database');
var bot=require('./telBot');
var moment = require('moment');


function startSendingSalesAndReturnsMsgBySchedule(appConfig){                                                           logger.info("startSendingSalesAndReturnsMsgBySchedule");
    var dailySalesRetSchedule=appConfig.dailySalesRetSchedule;
    var dailySalesRetUsers=appConfig.dailySalesRetUsers;
    if(!dailySalesRetSchedule||cron.validate(dailySalesRetSchedule)==false
        ||!dailySalesRetUsers|| dailySalesRetUsers.length==0)
        return;
    var scheduleSalesAndReturnsMsg =cron.schedule(dailySalesRetSchedule,
        function(){
            sendSalesAndReturnsMsg(dailySalesRetUsers);
        });
    scheduleSalesAndReturnsMsg.start();
};
module.exports.startSendingSalesAndReturnsMsgBySchedule=startSendingSalesAndReturnsMsgBySchedule;

function sendSalesAndReturnsMsg(dailySalesRetUsers){                                                                logger.info("SENDING SALES AND RETURNS REPORTS MSG BY SCHEDULE...");
    database.getDailySalesRetUsersByPhone(dailySalesRetUsers, function(err,res){                                    logger.info(res.length + " CHIEFS WAS FOUND IN DATABASE");
        if(err) {
            logger.error("FAILED to get user chat ID for daily sales and returns msg. Reason: " + err);
            if (err.name == 'ConnectionError') {
                database.connectToDBRecursively(0, "при попытке рассылки сообщений о суммах продаж и возвратов ", function (err) {
                    if (!err) {
                        sendSalesAndReturnsMsg(dailySalesRetUsers);
                    }
                });
            }
            return;
        }
        var chiefChatArr=res;
        if(!chiefChatArr || chiefChatArr.length==0)return;
        makeSalesAndReturnsMsg(function(err,chiefMsg){
            if(err) {
                logger.error("Failed to make sales and returns msg. Reason: "+err.message?err.message:err);
                return;
            }
            sendSalesAndReturnsMsgRecursively(0,chiefChatArr, chiefMsg);
        });
    });
}

function sendSalesAndReturnsMsgRecursively(index,chiefArray, msg){
    if(!chiefArray[index]) return;
    var chief=chiefArray[index];
    logger.info("Daily sales and returns msg is sending to "+chief["EmpName"]+" (EmpID:"+chief["EmpID"] +") TChatID:" +
        + chief["TChatID"]+" ("+chief["Mobile"]+")" );
    setTimeout(function () {
        bot.sendMessage(chief.TChatID, msg, {parse_mode:"HTML"},300);
        sendSalesAndReturnsMsgRecursively(index+1,chiefArray, msg);
    });
}

function makeSalesAndReturnsMsg(callback){
    var adminMsg='<b>Информация о суммах движения товара на '+moment(new Date()).format('HH:mm DD.MM.YYYY')+' </b> \n';
    database.getSalesAndRetSum(function(err, res){
        if(err) {
            callback(err);
            return;
        }
        var sumData=res;
        if(sumData.length==0) {
            adminMsg+="\n<b>Нет данных.</b>";
            callback(null,adminMsg);
        }else{
            for (var i in sumData){
                var dataItem=sumData[i];
                adminMsg+="\n <b> "+dataItem.StockName+"</b>:   +"+dataItem.SaleSum +",   -"+dataItem.RetSum;
            }
            callback(null,adminMsg);
        }
    })
};