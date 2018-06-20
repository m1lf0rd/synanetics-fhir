var fs = require('fs');

function extractResourceExpressions(resource,expression)
{
    let out=[];
    let ors = expression.split('|');
    for (let a in ors) 
    {
        ors[a]=ors[a].trim();
        if (ors[a].startsWith(resource+'.')) out.push(ors[a].substr(resource.length+1));
    }
    return out.join('|');

}
function SearchTerms() {
    try{

        schemaPath='standard/'+global.config.FHIRversion+'/search-parameters.json';
        let all = JSON.parse(fs.readFileSync(schemaPath)).entry;
        let searchTerms = [];
        for (let term in all ) {
            for (let iresource in all[term].resource.base) {
                let resource = all[term].resource.base[iresource];
                if (!searchTerms[resource]) searchTerms[resource]=[];
                if (all[term].resource.expression) searchTerms[resource]["%"+all[term].resource.code]=extractResourceExpressions(resource,all[term].resource.expression);

            }
        }
        // Custom terms
        searchTerms["Patient"]["%relationship"]="contact.relationship";
        return searchTerms;
    }
    catch (e) {
        console.log(e);
        return null;
    }
    
}

module.exports = SearchTerms;