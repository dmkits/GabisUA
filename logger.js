var winston = require('winston');
var fs=require('fs');
var path=require('path');
var dateformat=require("dateformat");

function makeLogger(){
    var logDir= path.join(__dirname, './logs/');
    try {
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir);
        }
    }catch (e){
        console.log("FAIL to make log file. Reason: ",e);
    }
    var transports  = [];
    transports.push(new (require('winston-daily-rotate-file'))({
        name: 'file',
        datePattern: '.yyyy-MM-dd',
        filename: path.join(logDir, "log_file.log"),
        timestamp:function() {
            return dateformat(Date.now(), "yyyy-mm-dd HH:MM:ss.l");
        }
    }));
    transports.push(new (winston.transports.Console)({timestamp:function() {
        return dateformat(Date.now(), "yyyy-mm-dd HH:MM:ss.l");
    }}));

    var logger = new winston.Logger({transports: transports,level:'silly', timestamp: function() {
        return dateformat(Date.now(), "yyyy-mm-dd HH:MM:ss.l");
    }});
    return logger;
}
module.exports=function(){
  return makeLogger();
};