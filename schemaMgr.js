var fs = require('fs');

class SchemaMgr {

    constructor(){
        this.schemas=[];
    }

    Open(schema)
    {
        if (!schema.includes('.')) schema = schema+'.schema.json';
        try {
            if (!this.schemas[schema]) {
                let schemaPath='standard/'+global.config.FHIRversion+'/schema/'+schema;
                this.schemas[schema] = JSON.parse(fs.readFileSync(schemaPath));
            }
        }
        catch (e) {
            return null;
        }
        return this.schemas[schema];
    }
}

module.exports = SchemaMgr;