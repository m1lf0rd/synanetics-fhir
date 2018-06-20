

class SchemaReader {
    constructor(schemaMgr){
        this.schemaMgr=schemaMgr;
        this.path="";
        this.property=null;
        this.currentSchema=null;
        this.currentSection=null;
    }
    
    Attach(resource){
        this.path="$";
        this.property=null;
        this.currentSchema=this.schemaMgr.Open(resource);
        this.currentSection= this.currentSchema.definitions[resource];
    }
    
    MoveTo(property) {
        while (property.includes('.')) {
            let dotat = property.indexOf('.');
            if (!this.MoveTo(property.substr(0,dotat))) return false;
            property = property.substr(dotat+1);
        }
        if (this.currentSection=="") throw "Resource not attached";
        if (this.path=="$") {
            return this.findPropertyInClassDef(this.currentSchema,this.currentSection,property);
        }
        else if (this.property["$ref"]) {
            let next=this.refToSchemaSection(this.property["$ref"],this.currentSchema);
            return this.findPropertyInClassDef(next.schema,next.section,property);
        }
        else if (this.property.type=='array' && this.property.items["$ref"]) {
            let next=this.refToSchemaSection(this.property.items["$ref"],this.currentSchema);
            return this.findPropertyInClassDef(next.schema,next.section,property);
        }
        return false;
    }

    refToSchemaSection(ref,currentSchema)
    {
        let refParts=ref.split('#');
        let pathParts = refParts[1].split('/');
        let retval = {schema:'',section:''};
        retval.schema = refParts[0]!=""?this.schemaMgr.Open(refParts[0]):currentSchema;
        retval.section = retval.schema;
        for (let i=1;i<pathParts.length;i++) retval.section=retval.section[pathParts[i]];
        return retval;
    }

    findPropertyInClassDef(schema,section,property)
    {
        for (let iSubclass=section.allOf.length-1;iSubclass>=0;iSubclass--){
            if (section.allOf[iSubclass].properties) {
                for (let aProp in section.allOf[iSubclass].properties )
                    if (aProp==property) 
                    {
                        if (this.property && this.property.type=="array") this.path+="[*]";
                        this.path=this.path+"."+property;
                        this.property=section.allOf[iSubclass].properties[aProp];
                        this.currentSchema=schema;
                        this.currentSection=section;
                        return true;
                    }
            }
            else if (section.allOf[iSubclass]['$ref']) {
                let next=this.refToSchemaSection(section.allOf[iSubclass]['$ref'],this.currentSchema);
                if (this.findPropertyInClassDef(next.schema,next.section,property))
                    return true;
            }    
        }
        return false;
    }

}

module.exports = SchemaReader;