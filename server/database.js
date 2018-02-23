var mssql=require('mssql');
var fs= require('fs');
var path=require('path');
var DbConnectionError=null;
var configName=null;
var logger=require('./logger')();
// var telBotSysadmins = require('./telBotSysadmins')();

module.exports.getDbConnectionError= function(callback){
   setImmediate(function(){
       callback(DbConnectionError);
   });
};

function connectToDB(callback){
    var appConfig=getAppConfig();
    mssql.close();
    mssql.connect({
        "user": appConfig.dbUser,
        "password": appConfig.dbPassword,
        "server": appConfig.dbHost,
        "database": appConfig.database
    }, function(err){
        if(err){
            callback(err);
            DbConnectionError=err;
            logger.error("FAILED to connect to DB. Reason: "+err);
            return;
        }
        var request = new mssql.Request();
        request.query('select 1',
            function(err,res) {
                if (err) {
                    DbConnectionError = err;
                    callback(err);
                    return;
                }
                DbConnectionError=null;
                 callback();
            });
    });
};
module.exports.connectToDB=connectToDB;
module.exports.setAppConfig=function(configFileName){
    configName = configFileName;
};

function getAppConfig(){
   var appConfig;
    try{
        appConfig=JSON.parse(fs.readFileSync(path.join(__dirname, '../'+configName+'.json')))
    }catch(e){
        logger.error("FAILED to get data from config file. Reason: "+ e);
    }
   return appConfig;
};
module.exports.getAppConfig=getAppConfig;

function connectToDBRecursively(index, callingFuncMsg, callback){
    connectToDB(function(err){
        if(err && index<5){
            setTimeout(function(){
                connectToDBRecursively(index+1,callingFuncMsg,callback);
            },5000);
        }else if(err && index==5){
            var telBotSysadmins = require('./telBotSysadmins');
            telBotSysadmins.sendMsgToSysadmins("Не удалось подключиться к БД "+callingFuncMsg+ ". Причина:"+err);
            if(callback)callback(err);
        }else if(callback) callback();
    });
}
module.exports.connectToDBRecursively=connectToDBRecursively;


module.exports.checkPhoneAndWriteChatID=function(phoneNum, chatId, callback){
    var request = new mssql.Request();
    request.input('Mobile', phoneNum);
    request.query('select EmpID, EmpName, ShiftPostID from r_Emps WHERE Mobile=@Mobile',
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            var employeeDataArr  =res.recordset;
            request.input('TChatID', chatId);
            request.query('update r_Emps set TChatID=@TChatID where Mobile=@Mobile',
                function(err, res){
                    if(err){
                        callback(err);
                        return;
                    }
                    callback(null,employeeDataArr);
                });
    })
};

module.exports.getAdminChatIds=function(callback){
    var request = new mssql.Request();
    request.query("select EmpID, EmpName, ShiftPostID, Mobile, TChatID from r_Emps " +
        "where ShiftPostID=1 and LTRIM(ISNULL(Mobile,''))<>'' and LTRIM(ISNULL(TChatID,''))<>''",
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            if(!res.recordset || res.recordset.length==0){
                callback({err:"Не удалось найти ни одного номера телефона в справочнике администраторов."});
                return;
            }
            callback(null,res.recordset);
        });
};

module.exports.getUnconfirmedTRecData=function(callback){        //Unconfirmed pinvs
    var request = new mssql.Request();
    request.query("select m.StockID, st.StockName, Count(1) as Total " +
        "from t_Rec m " +
        "inner join r_Stocks st on st.StockID=m.StockID" +
        " where m.StateCode=50" +
        "group by m.StockID, st.StockName " +
        "order by m.StockID",
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            callback(null,res.recordset);
        });
};

module.exports.getReturnedTRecData=function(callback){           //Returned pinvs
    var request = new mssql.Request();
    request.query("select m.StockID, st.StockName, Count(1) as Total " +
        "from t_Rec m " +
        "inner join r_Stocks st on st.StockID=m.StockID" +
        " where m.StateCode=52" +
        "group by m.StockID, st.StockName " +
        "order by m.StockID",
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            callback(null,res.recordset);
        });
};

module.exports.getUnconfirmedTExcData=function(callback){                                       //Unconfirmed movement invs
    var request = new mssql.Request();
    request.query("select m.NewStockID, st.StockName, Count(1) as Total " +
        "from t_Exc m " +
        "inner join r_Stocks st on st.StockID=m.NewStockID " +
        "where m.StateCode in (56,50) " +
        "group by m.NewStockID, st.StockName " +
        "order by m.NewStockID",
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            callback(null,res.recordset);
        });
};

module.exports.getReturnedTExcData=function(callback){                                          //Returned movement invs
    var request = new mssql.Request();
    request.query("select m.NewStockID, st.StockName, Count(1) as Total " +
        "from t_Exc m " +
        "inner join r_Stocks st on st.StockID=m.NewStockID " +
        "where m.StateCode=58 " +
        "group by m.NewStockID, st.StockName " +
        "order by m.NewStockID",
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            callback(null,res.recordset);
        });
};

module.exports.getCashierDataArr=function(EmpID, callback){
    var request = new mssql.Request();
    var queryStr="select e.EmpID, e.EmpName, e.ShiftPostID, e.Mobile, e.TChatID, cr.StockID, cr.CRID, cr.CRName, st.StockName " +
        "from r_Emps e " +
        "inner join r_Opers op on op.EmpID=e.EmpID " +
        "inner join r_OperCRs opcr on opcr.OperID=op.OperID " +
        "inner join r_CRs cr on cr.CRID=opcr.CRID " +
        "inner join r_Stocks st on st.StockID=cr.StockID " +
        "where e.ShiftPostID=0 ";
    if(EmpID){
        request.input('EmpID', EmpID);
        queryStr+="and e.EmpID=@EmpID "
    }
    queryStr+="and LTRIM(ISNULL(Mobile,''))<>'' "+
              "and LTRIM(ISNULL(TChatID,''))<>'' " +
              "order by e.EmpID, cr.StockID";
    request.query(queryStr,
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            callback(null,res)
        });
};

module.exports.getUnconfirmedTRecByStockId=function(stockID, callback){
    var request = new mssql.Request();
    request.input('StockID', stockID);
    request.query("select m.DocID, m.DocDate, m.OurID, m.StockID, m.Notes, m.StateCode " +
        "from t_Rec m " +
        "where m.StateCode=50 and m.StockID=@StockID "+
        "order by m.DocDate, m.DocID",
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            callback(null,res);
        });
};

module.exports.getUnconfirmedTExcByStockId=function(stockID, callback){
    var request = new mssql.Request();
    request.input('StockID', stockID);
    request.query("select m.DocID, m.DocDate, m.OurID, m.NewStockID, m.Notes, m.StateCode " +
        "from t_Exc m " +
        "where m.StateCode in(50,56)  " +
        "and m.NewStockID=@StockID "+
        "order by m.DocDate, m.DocID",
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            callback(null,res);
        });
};

module.exports.getReturnedTExcByStockId=function(stockID, callback){
    var request = new mssql.Request();
    request.input('StockID', stockID);
    request.query("select m.DocID, m.DocDate, m.OurID, m.Notes " +
        "from t_Exc m " +
        "where m.StateCode = 58  " +
        "and m.StockID=@StockID "+
        "order by m.DocDate, m.DocID",
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            callback(null,res);
        });
};

module.exports.getTSestByStockId=function(stockID, callback){
    var request = new mssql.Request();
    request.input('StockID', stockID);
    request.query("select distinct m.ChID, m.DocID, m.DocDate " +
        "from t_SEst m inner join t_SEstD d on  d.ChID=m.ChID and d.StockID=@StockID " +
        "where m.DocDate=dbo.zf_GetDate(GETDATE()) " +
        "and ISNULL((select Count(1) from it_SEstTBotMsgSends " +
        "where ChID=m.ChID group by ChID),0)<3",
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            callback(null,res);
        });
};

module.exports.setSEstMsgCount=function(ChID,callback){
    var request = new mssql.Request();
    request.query("insert into it_SEstTBotMsgSends(ChID,MsgSendsDate) values ("+ChID+", GETDATE())",
        function(err,res){
            if(err){
                if(err){
                    logger.error("FAILED to insert to  msgCount in it_SEstTBotMsgSends.Reason: "+err);
                }
            }
            callback();
        });
};

module.exports.getSalesAndRetSum=function(callback){
    var request = new mssql.Request();
    var queryStr="select st.StockName, ISNULL(s.SaleSum,0) as SaleSum, ISNULL(r.RetSum,0) as RetSum\n" +
        "from r_Stocks st\n" +
        "left join (\n" +
        "\tselect s.StockID, SUM(sp.SumCC_wt) as SaleSum \n" +
        "\tfrom t_Sale s,t_SalePays sp \n" +
        "\twhere sp.ChID=s.ChID and s.DocDate=dbo.zf_GetDate(GETDATE()) \n" +
        "\tgroup by s.StockID\n" +
        "\t) s on s.StockID=st.StockID\n" +
        "left join (\n" +
        "\tselect r.StockID, SUM(rp.SumCC_wt) as RetSum \n" +
        "\tfrom t_CRRet r,t_CRRetPays rp \n" +
        "\twhere rp.ChID=r.ChID and r.DocDate=dbo.zf_GetDate(GETDATE()) \n" +
        "\tgroup by r.StockID\n" +
        "\t) r on r.StockID=st.StockID\n" +
        "where NOT (s.StockID is NULL and r.StockID is NULL);\n";
    request.query(queryStr,
        function(err,res){
            if(err){
                if(err){
                    logger.error("FAILED to get sales and returns sums. Reason: "+err);
                    callback(err);
                    return;
                }
            }
            callback(null,res.recordset);
        });
};
module.exports.getDailySalesRetUsersByPhone=function(phoneNumArr, callback){
     if(phoneNumArr.length==0){
        callback();
        return;
    }
    var phoneStr="(";
    for(var i in phoneNumArr){
        phoneStr=phoneStr+"'"+phoneNumArr[i]+"'";
        if(i<phoneNumArr.length-1){
            phoneStr=phoneStr+",";
        }
    }
    phoneStr=phoneStr+")";
    var request = new mssql.Request();
    var queryStr="select EmpID, EmpName, ShiftPostID, Mobile, TChatID from r_Emps where ShiftPostID=1 AND Mobile in " + phoneStr;
    request.query(queryStr,
        function(err,res){
            if(err){
                if(err){
                    logger.error("FAILED to get users chatID for daily sales and returns messages. Reason: "+err);
                    callback(err);
                    return;
                }
            }
            callback(null,res.recordset);
        });
};