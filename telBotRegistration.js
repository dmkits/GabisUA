var logger=require('./logger')();
var database = require('./database');
var bot=require('./telBot');
var telBotSysadmins=require('./telBotSysadmins');
var telBotSalesReport=require('./telBotSalesReport');
var telBotAdmins=require('./telBotAdmins');
var telBotCashiers=require('./telBotCashiers');


function registerTelBotUser(phoneNumber){
    if(phoneNumber[0]=="+")phoneNumber=phoneNumber.substring(1);
    database.getDbConnectionError(function(dbConnectionError){
        if(dbConnectionError){
            telBotSysadmins.checkAndRegisterSysAdmin(msg, function(sysAdminRegistered){
                if(!sysAdminRegistered){
                    bot.sendMessage(msg.chat.id, "Не удалось зарегистрировать пользователя Telegram. Обратитесь к системному администратору.").catch((error)=>{
                        logger.warn("Failed to send msg to user. Chat ID:"+ msg.chat.id +" Reason: ",error.response.body);
                    });
                }
            });
            return;
        }
        telBotSysadmins.checkAndRegisterSysAdmin(msg, function(sysAdminRegistered){

            database.checkPhoneAndWriteChatID(phoneNumber,msg.chat.id,
                function(err,employeeDataArr){
                    if(err){
                        logger.error("Failed to check phone number and write chat ID. Reason: "+err);
                        bot.sendMessage(msg.chat.id, "Не удалось зарегистрировать служащего. Обратитесь к системному администратору.").catch((error)=>{
                            logger.warn("Failed to send msg to user. Chat ID:"+ msg.chat.id +" Reason: ",error.response.body);
                        });
                        return;
                    }
                    if((!employeeDataArr || employeeDataArr.length==0) && !sysAdminRegistered){
                        logger.warn("Failed to register user. Phone number was not found in DB . Phone number: "+phoneNumber);
                        bot.sendMessage(msg.chat.id, "Номер телефона не найден в справочнике сотрудников.").catch((error)=>{
                            logger.warn("Failed to send msg to user. Chat ID:"+ msg.chat.id +" Reason: ",error.response.body);
                        });
                    }
                    sendMsgToAllUsersWithPhone(0,employeeDataArr,phoneNumber,msg.chat.id);
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
    var status=employee.ShiftPostID==1 ? "администратор":"кассир";
    var empID=employee.EmpID;
    logger.info("New user registered successfully as " +status+ ". Phone number: "+mobile);
    bot.sendMessage(chatId, "Регистрация служащего для рассылки прошла успешно. Статус служащего: "+status+".").catch((error)=>{
        logger.warn("Failed to send msg to user. Chat ID:"+ chatId +" Reason: ",error.response.body);
    });
    if(employee.ShiftPostID===1){
        telBotAdmins.makeUnconfirmedDocsMsg(function(err, adminMsg){
            if(err){
                logger.error("FAILED to make unconfirmed docs msg"+err);
                return;
            }
            logger.info("Unconfirmed docs msg is sending. Phone number: "+mobile);
            bot.sendMessage(chatId, adminMsg, {parse_mode:"HTML"}).catch((error)=>{
                logger.warn("Failed to send msg to user. Chat ID:"+ chatId +" Reason: ",error.response.body);
            });
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
    }
}