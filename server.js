var http = require('http');
const SchemaMgr = require('./schemaMgr');
const SchemaReader = require('./schemaReader');
const SearchTerms = require('./searchTerms');
const Utils = require('./utils');

class RestServer {
	constructor(){
        this.db="";
        this.schemaMgr=new SchemaMgr;
        this.searchTerms = SearchTerms();
    }
    RunService(db,port) {
      
        this.db=db;
		http.createServer((httpRequest, httpResponse) => this.handler(httpRequest, httpResponse)).listen(port);
		console.log('FHIR server running at port ' + port);
    }
	handler(httpRequest, httpResponse) {
		let This = this;
		
        this.parse(httpRequest)
        .then( (response) => {
            return response;

        } )
		.then(  (response) => {
			        console.log('Request [' + httpRequest.url + '], response: '+response);
			        This.respond(httpResponse, response);
		        }, 
		        (exception) => {
			        console.error('Request [' + httpRequest.url + '], error: ');
			        console.error(exception);

			        This.respond(httpResponse, exception);
		        })
		.catch((err) => {
			console.error('Request [' + httpRequest.url + '], catch: ');
			console.error(err);

			let error = This.getError(500, 'Internal server error');
			This.respond(httpResponse, error);
		});
	}
	
	respond(httpResponse, response) {
        let code = (response['code'])?response.code:500;
        let content = (response['content'])?response.content:null;
        let message = (response['message'])?response.message:null;
        let contentType = (response['contentType'])?response.contentType:null;

        let headers={};
        if (content)
        {
            let headers={'Content-Type':contentType?contentType:'application/json'};
        }
        httpResponse.writeHead(code,message,headers);
        httpResponse.end(content);
	}
	
	parse(httpRequest) {
		let This = this;
		
		return new Promise((resolve, reject) => {
            
            let method = httpRequest.method.toUpperCase();
            
            if(method === 'POST' || method === 'PUT' || method === 'PATCH') {
                if (httpRequest.headers['content-type'].toLowerCase().indexOf('application/json') !== 0) {
                    throw this.getError('BAD_CONTENT_TYPE', 'Content type not supported:' + httpRequest.headers['content-type'], {
						request : ''
					});
                }
				let queryData = '';
				httpRequest.on('data', function(data) {
		            queryData += data;
		        });

				httpRequest.on('end', function() {
					let params = JSON.parse(queryData);
					try{
    					let response = This.process(method,httpRequest.url,JSON.parse(queryData));
    					resolve(response);
					}
					catch(e) {
						reject(e);
					}
		        });
			}
			else {
				try{
					let response = This.process(method,httpRequest.url);
					resolve(response);
				}
				catch(e) {
					reject(e);
				}
			}
		});
	}

	process(method,uri,body) {
        try {
            let uriparts=uri.split('?');
            
            let queryparts=(uriparts.length>1)?uriparts[1].split('&'):[];
            
            let queryparams=[];
            for (let iQuery in queryparts)
            {
                let querypair=queryparts[iQuery].split('=');
                queryparams[decodeURIComponent(querypair[0])]=decodeURIComponent(querypair[1]);
                
            }
            let resourceParts = uriparts[0].split('/');
            let resource=resourceParts[1];
            let resourceId=resourceParts[2];
            let schema = this.schemaMgr.Open(resource);

            if (!schema) {
                return {
                    code: 400,
                    message: 'Invalid resource'
                };
            }
            switch (method) {
                case "POST":
                    if (resourceId || queryparams.length>0) {
                        return { code: 400, message: 'Bad Request' };
                    }
                    return this.post(resource,body);

                break;

                case "GET":
                    return this.search(resource,queryparams);

                break;
            } 
            console.log("default");
            return {
                code: 200,
                message: 'Success'
            };
        }
        catch (e)
        {
            console.log(e);
            return {
                code: 500,
                message: 'Internal Server Error'
            };
        }
    }
    post(resource,object) {
        if (object.id) delete object.id;
        return new Promise( (resolve,reject) => {
            this.db.collection(resource, (err,theCollection)=>{
                if (err) {
                        reject(err);
                }
                theCollection.insert(object,(err,result)=>{
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve({code:202,content:null});
                    }
                });
            });
        });
    }
    search(resource,searchparams)
    {
        let searchString="";
        let selector=[];
        for (let a in searchparams) {
            let parts=a.split(':');
            let searchTerm=parts[0];
            let modifier = (parts.length==1)?null:parts[1];
            if (this.searchTerms[resource] && this.searchTerms[resource]["%"+searchTerm])
                selector.push(Utils.ConstructMongoSearch(new SchemaReader(this.schemaMgr),resource,this.searchTerms[resource]["%"+searchTerm], modifier,searchparams[a]));
        }
        if (selector.length==0) selector={};
        else if (selector.length==1) selector = selector[0];
        else selector = {'$and':selector};

        console.log(JSON.stringify(selector));

        return new Promise( (resolve,reject) => {
            this.db.collection(resource, (err,theCollection)=>{
                if (err) {
                        reject(err);
                }
                theCollection.find(selector).toArray((err,result)=>{
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve({code:200,content:JSON.stringify(result)});
                    }
                });
            });
        });
    }
	
	getError(code, message, args) {
		return {
			code : code,
            message : message,
			parameters: args
		};
	}
}

module.exports = RestServer;