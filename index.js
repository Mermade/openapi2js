/* openAPI2js - generate simple Javascript API from Swagger spec suitable for use with OpenNitro SDK
*/

var fs = require('fs');
var path = require('path');

var map = [];

String.prototype.toCamelCase = function camelize() {
	return this.toLowerCase().replace(/[-_ \/\.](.)/g, function(match, group1) {
		return group1.toUpperCase();
    });
}

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

function uniq(s) {
	var result = s;
	count = 2;
	while (map.indexOf(result)>=0) {
		result = s + count;
		count++;
	}
	return result;
}

module.exports = {

	openAPI2js : function(input,outfile) {

		var swagger = {};
		if (typeof input === 'object') {
			swagger = input;
		}
		else {
			swagger = require(path.resolve(input));
		}
		var actions = ['get','head','post','put','delete','patch','options','trace','connect'];
		var out = '';

		for (var sp in swagger.parameters) {
			var swagParam = swagger.parameters[sp];
			if (swagParam['in'] == 'query') {
				var cName = 'common'+('/'+swagParam.name).toCamelCase();
				out += 'const ' + cName + " = '" + swagParam.name + "';\n";
				if (swagParam['enum']) {
					for (var e in swagParam['enum']) {
						var value = swagParam['enum'][e];
						out += 'const common'+('/'+swagParam.name+'/'+value).toCamelCase() +
							" = '" + swagParam.name + "=" + value + "';\n";
					}
				}
				map.push(cName);
			}
		}

		for (var p in swagger.paths) {
			var sPath = swagger.paths[p];
			for (var a in actions) {
				var action = sPath[actions[a]];
				if (action) {
					out += '\n/* '+(action.description ? action.description : action.summary ? action.summary : 'No description')+' */\n';
					pRoot = p.replace('.atom','');
					pRoot = pRoot.replace('.xml','');
					pRoot = pRoot.replace('.json','');

					var pName = (actions[a]+pRoot).toCamelCase();
					var pName = uniq(pName);

					if (p.indexOf('{')>=0) {
						var params = [];
						var p2 = pRoot.replace(/(\{.+?\})/g,function(match,group1){
							params.push(group1.replace('{','').replace('}',''));
							return '';
						});
						p2 = p2.replace('-/','/');

						pName = (actions[a]+p2).replaceAll('//','/').toCamelCase();
						if (pName[pName.length-1] == '-') pName = pName.substr(0,pName.length-1);
						while (pName[pName.length-1] == '/') pName = pName.substr(0,pName.length-1);
						pName = pName.replaceAll('/','');
						pName = uniq(pName);

						out += 'function '+pName+'(';
						for (var arg in params) {
							if (params[arg].substr(0,1).match(/[0-9]/)) {
								params[arg] = '_'+params[arg];
							}
							out += (arg > 0 ? ',' : '') + params[arg].toCamelCase();
						}
						out += '){\n';
						out += "  var p = '" + (swagger.basePath + p).replaceAll('//','/') + "';\n";
						for (var arg in params) {
							out += "  p = p.replace('{" + params[arg] + "}'," + params[arg].toCamelCase() + ");\n";
						}
						out += '  return p;\n';
						out += '}\n';
					}
					else {
						out += 'const '+pName+" = '"+swagger.basePath+p+"';\n";
					}
					map.push(pName);

					for (var sp in action.parameters) {
						var swagParam = action.parameters[sp];
						if ((swagParam['in'] == 'query') || (swagParam["enum"])) {
							if (swagParam['in'] == 'query') {
								out += 'const '+pName+('/'+swagParam.name).toCamelCase() + " = '" + swagParam.name + "';\n";
							}
							if (swagParam['enum']) {
								for (var e in swagParam['enum']) {
									var value = swagParam['enum'][e];
									out += 'const '+pName+('/'+swagParam.name+'/'+value).toCamelCase() +
										" = '" + (swagParam['in'] == 'query' ? swagParam.name + "=" : '') + value + "';\n";
								}
							}
						}
					}

				}
			}
		}

		out += '\nmodule.exports = {\n';
		for (var m in map) {
			out += '  ' + map[m] + ' : ' + map[m] + ',\n';
		}
		out += "  host : '" + swagger.host + "'\n";
		out += '};\n';

		if (outfile) fs.writeFileSync(outfile,out,'utf8');

		return out;
	}
};
