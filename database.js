var mssql=require('mssql');
var fs= require('fs');
var path=require('path');
var dbConnected;


module.exports.connectToDB=function(callback){
    var dbConfig=this.getDBConfig();
    mssql.close();
    mssql.connect({
        "user": dbConfig.user,
        "password": dbConfig.password,
        "server": dbConfig.host,
        "database": dbConfig.db_name
    }, err =>{
       callback(err);
        console.log("connectToDB err=",err);
    })
};

module.exports.getDBConfig=function(){
    var dbConfig;
    try{
    dbConfig=JSON.parse(fs.readFileSync(path.join(__dirname,'./config.json')))
    }catch(e){
         console.log("dbConfig parse ERROR=",e);
    }
   return dbConfig;
};