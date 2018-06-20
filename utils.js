function FHIRType(schemapath)
{
    if (!schemapath) return null;
    return schemapath.split('.')[0];
}
function normaliseValForType(val,property,modifier)
{
    // returns either an array (in which case which dotted notation is used to select both properties)
    // or a $elemMatch for selecting documents embedded in an array

    if (modifier=='missing')
    {
        return (val=='false') ?{'$ne':null}:null;
    }

    var parts;
    var scalarType = FHIRType(property['$ref']);
    if (!scalarType) scalarType = property.type;
    var arrayType = (property.type=="array")?FHIRType(property.items['$ref']):null;
    if (!arrayType) arrayType = (property.type=="array")?property.items.type:null;

    // tokens
    if (scalarType == "CodeableConcept"  || arrayType == "CodeableConcept") {

        let ret=[];

        if (modifier=='text')
        {
            ret[0]=[];
            ret[0]['coding.display']={'$regex':('^'+val),'$options':'i'};
            ret[1]=[];
            ret[1]['text']={'$regex':('^'+val),'$options':'i'};
            return ret;
        } 
        parts=val.split('|');
        parts[0]=(parts[0]==''?null:parts[0]);
        
        if (parts.length==1) ret['coding.code']=parts[0];
        else if (parts[1]=='') ret['coding.system']=parts[0];
        else ret['coding']={'$elemMatch' : {system:parts[0],code:parts[1]}};
        return ret;
    }
    if (scalarType == "Identifier" || scalarType == "Coding" || scalarType == "ContactPoint") {

        let ret=[];
        if (modifier=='text' && scalarType == "Identifier")
        {
            ret['type.text']={'$regex':('^'+val),'$options':'i'};
            return ret;
        }

        parts=val.split('|');
       
        parts[0]=(parts[0]==''?null:parts[0]);
        if (parts.length==1) ret[(scalarType == "Coding")?'code':'value']=parts[0];
        else {
            ret[(scalarType == "ContactPoint")?'use':'system']=parts[0];
            if (parts[1]!='') ret[(scalarType == "Coding")?'code':'value']=parts[1];
        }
        return ret;
    }
    if (arrayType == "Identifier"  || arrayType == "Coding" || arrayType == "ContactPoint") {

        // TODO add :text support

        parts=val.split('|');
        let ret={};
        parts[0]=(parts[0]==''?null:parts[0]);
        if (parts.length==1) ret[(arrayType == "Coding")?'code':'value']=parts[0];
        else {
            ret[(arrayType == "ContactPoint")?'use':'system']=parts[0];
            if (parts[1]!='') ret[(arrayType == "Coding")?'code':'value']=parts[1];
        }
        return {'$elemMatch' : ret};
    }
    // strings
    if (scalarType=='string' || arrayType=='string')
    {
        if (modifier=='contains') return {'$regex':val};
        if (modifier=='exact') return val;
        return  {'$regex':('^'+val), '$options':'i'};
    }
    return val;
}
function normaliseExpression(schemaReader,resource,exp,modifier,val)
{
    let oTerm = {};
    let part;
    // as(Reference)
    let mch = exp.match(/\.as\(([^\)]+)\)/);
    if (mch) exp = exp.substr(0,mch.index) + mch[1] + exp.substr(mch.index+mch[0].length);

    //where(type=/'blah/')
    mch = exp.match(/\.where\(([^\)]+)=([^\)]+)\)/);
    if (mch) 
    {
        let oMatch = {};
        oMatch[mch[1]] = mch[2].replace("\\'","'");

        let arrayPart = exp.substr(0,mch.index);
        let matchPart = exp.substr(mch.index+mch[0].length);
        if (schemaReader.MoveTo(arrayPart) && schemaReader.MoveTo(matchPart)) val=normaliseValForType(val,schemaReader.property,modifier);
        if (Array.isArray(val)){
            if (val.length==1) {
                // supports either a single dimensional array or a 2-dimensional array with a single value in the first dimension
                if (Array.isArray(val[0])) for (part in val[0]) oMatch[matchPart+"."+part]=val[0][part];
                else for (part in val) oMatch[matchPart+"."+part]=val[part];
            }
            else
            {
                // a sequence of conditions to be $or'd
                let ret=[];
                for (let i in val) {
                    let orMatch=oMatch;
                    for (part in val[i]) orMatch[matchPart+"."+part]=val[i][part];
                    ret[i][arrayPart] = {'$elemMatch' : orMatch};
                }
                return ret;
            }
        }
        else {
            oMatch[matchPart]=val;
        }
        oTerm[arrayPart] = {'$elemMatch' : oMatch};
    }
    else 
    {
        if (schemaReader.MoveTo(exp)) val=normaliseValForType(val,schemaReader.property,modifier);
        if (Array.isArray(val)){
            console.log(val);
            console.log(val.length);
            if (val.length==1) {
                // supports either a single dimensional array or a 2-dimensional array with a single value in the first dimension
                if (Array.isArray(val[0])) 
                {
                    console.log('there')
                    for (part in val[0]) oTerm[exp+"."+part]=val[0][part];
                }
                else 
                {
                    console.log('here')
                    for (part in val) oTerm[exp+"."+part]=val[part];
                }
            }
            else {
                // a sequence of conditions to be $or'd
                let ret=[];
                for (let i in val) {
                    ret[i]={};
                    for (part in val[i]) ret[i][exp+"."+part]=val[i][part];
                }
                return ret;
            }
        }
        else {
            oTerm[exp]=val;
        }
    }

    return oTerm;
}

class Utils
{
    
    static ConstructMongoSearch(schemaReader,resource,expression,modifier,val)
    {
        let ors = expression.split('|');
        let objTerms=[];

        for (let i in ors)
        {
            schemaReader.Attach(resource);
            let exp = normaliseExpression(schemaReader,resource,ors[i].trim(),modifier, val);
            if (Array.isArray(exp)) objTerms = objTerms.concat(exp);
            else  objTerms.push(exp);
        }
        if (objTerms.length==1) return objTerms[0];
        return {'$or': objTerms};
    }
}

module.exports = Utils;