var fs = require('fs');

function Config(configPath='') {
    configPath=configPath==''?'config.json':configPath;
    return JSON.parse(fs.readFileSync(configPath));

}

module.exports = Config;