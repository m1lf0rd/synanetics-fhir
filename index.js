const FHIRServer = require('./server');
const Config = require('./config');
const MongoClient = require('mongodb').MongoClient;
const MongoServer = require('mongodb').MongoServer;

if (global.config)
{
  console.log("Global config is already defined. Cannot execute");
  return;
}
global.config = Config();

let server = new FHIRServer();

console.log(JSON.stringify(global.config));

MongoClient.connect(config.db,  (err,db)=> 
  {
      if (err)
      {
        console.log("Failed to connect to MongoDB");
      }
      else
      {
        let theDb = db.db();

        server.RunService(theDb,config.port);
      }
    });
