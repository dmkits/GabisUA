var logger=require('./logger')();
var database = require('./database');
var bot=require('./telBot');
var telBotSysadmins=require('./telBotSysadmins');
var telBotAdmins=require('./telBotAdmins');
var telBotCashiers=require('./telBotCashiers');

function registerTelBotUser(phoneNumber, chatId){
    if(phoneNumber[0]=="+")phoneNumber=phoneNumber.substring(1);
    database.getDbConnectionError(function(dbConnectionError){
        if(dbConnectionError){
            telBotSysadmins.checkAndRegisterSysAdmin(phoneNumber,chatId, function(sysAdminRegistered){
                if(!sysAdminRegistered){
                    bot.sendMessage(chatId, "Не удалось зарегистрировать пользователя Telegram. Обратитесь к системному администратору.");
                }
            });
            return;
        }
        telBotSysadmins.checkAndRegisterSysAdmin(phoneNumber,chatId, function(sysAdminRegistered){
            database.checkPhoneAndWriteChatID(phoneNumber,chatId,
                function(err,employeeDataArr){
                    if(err){
                        logger.error("Failed to check phone number and write chat ID. Reason: "+err);
                        bot.sendMessage(chatId, "Не удалось зарегистрировать служащего. Обратитесь к системному администратору.");
                        return;
                    }
                    if((!employeeDataArr || employeeDataArr.length==0) && !sysAdminRegistered){
                        logger.warn("Failed to register user. Phone number was not found in DB . Phone number: "+phoneNumber);
                        bot.sendMessage(chatId, "Номер телефона не найден в справочнике сотрудников.");
                    }
                    sendMsgToAllUsersWithPhone(0,employeeDataArr,phoneNumber,chatId);
                })
        });
    });
}
module.exports.registerTelBotUser=registerTelBotUser;

function sendMsgToAllUsersWithPhone(index, employeeData,mobile,chatId){
    if(!employeeData[index]) {
        return;
    }
    var employee=employeeData[index];
    var status;
    switch (employee.ShiftPostID){
        case 0: status="кассир";
            break;
        case 1: status="администратор";
            break;
        case 2: status="директор";
            break;
    }

    var empID=employee.EmpID;
    logger.info("New user registered successfully as " +status+ ". Phone number: "+mobile);
    bot.sendMessage(chatId, "Регистрация служащего для рассылки прошла успешно. Статус служащего: "+status+".");
    if(employee.ShiftPostID===1){
        telBotAdmins.makeUnconfirmedDocsMsg(function(err, adminMsg){
            if(err){
                logger.error("FAILED to make unconfirmed docs msg"+err);
                return;
            }
            logger.info("Unconfirmed docs msg is sending. Phone number: "+mobile);
            bot.sendMessage(chatId, adminMsg, {parse_mode:"HTML"});
            sendMsgToAllUsersWithPhone(index+1, employeeData,mobile,chatId);
        });
    }else if(employee.ShiftPostID===0){
        database.getCashierDataArr(empID, function(err, res){
            if(err){
                logger.error("Failed to get cashier array. Reason: "+err);
                return;
            }
            if(!res.recordset || res.recordset.length==0){
                logger.warn("No registered cashiers was found in DB.");
                return;
            }
            var cashierDataArr=res.recordset;
            telBotCashiers.sendCashierMsgRecursively(0,cashierDataArr, false, function(){
                sendMsgToAllUsersWithPhone(index+1, employeeData,mobile,chatId);
            });
        })
    }else  sendMsgToAllUsersWithPhone(index+1, employeeData,mobile,chatId);
}