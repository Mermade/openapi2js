/* openAPI2js - generate simple Javascript API from openapi definition suitable for use with OpenNitro SDK
*/

var fs = require('fs');
var path = require('path');
var url = require('url');

var yaml = require('yaml');

var map = [];

String.prototype.toCamelCase = function camelize() {
	return this.toLowerCase().replace(/[-_ \/\.](.)/g, function(match, group1) {
		return group1.toUpperCase();
    });
};

function sanitise(s,brackets) {
	s = s.replaceAll('\'','').replaceAll('(','').replaceAll(')','').replaceAll(';','');
	if (brackets) s = s.replaceAll('{','').replaceAll('}','');
	return s;
}

function basePath(openapi) {
	if (openapi.basePath) return openapi.basePath;
	var s = '/';
	if (openapi.servers && openapi.servers.length) {
		s = url.parse(openapi.servers[0].url).path;
	}
	return s;
}

String.prototype.replaceAll = function(search, replacement) {
	var result = this;
	while (true) {
		result = result.split(search).join(replacement);
		if (result.indexOf(search)<0) break;
	}
	return result;
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

function extractParameters(container,prefix) {
	var out = '';
	for (var sp in container) {
		var oasParam = container[sp];
		var pEnum = (oasParam["enum"] ? oasParam["enum"] : (oasParam.schema ? oasParam.schema["enum"] : null));
		if (oasParam.description && ((oasParam['in'] == 'query') || pEnum)) {
			out += '/** ' + oasParam.description + ' */\n';
		}
		if (oasParam['in'] == 'query') {
			var cName = prefix+('/'+oasParam.name).toCamelCase();
			out += 'const ' + cName + " = '" + oasParam.name + "';\n";
			map.push(cName);
		}
		if (pEnum) {
			for (var e in pEnum) {
				var value = pEnum[e];
				var eName = prefix+('/'+oasParam.name+'/'+value).toCamelCase();
				if (oasParam['in'] == 'query') {
					out += 'const ' + eName + " = '" + oasParam.name + "=" + value + "';\n";
				}
				else {
					out += 'const ' + eName + " = '" + value + "';\n";
				}
				map.push(eName);
			}
		}
	}
	return out;
}

module.exports = {

	openAPI2js : function(input,outfile) {

		var openapi = {};
		if (typeof input === 'object') {
			openapi = input;
		}
		else {
			openapi = yaml.parse(fs.readFileSync(path.resolve(input),'utf8'));
		}
		var actions = ['get','head','post','put','delete','patch','options','trace','connect'];
		var out = '';

		out += '/**\n';
		out += '@author openapi2js http://github.com/mermade/openapi2js\n';
		out += '@copyright Copyright (c) 2017 Mike Ralphson\n';
		out += '@license https://opensource.org/licenses/BSD-3-Clause\n';
		out += '*/\n';

		out += extractParameters(openapi.parameters,'common');
		if (openapi.components) {
			out += extractParameters(openapi.components.parameters,'common');
		}

		for (var p in openapi.paths) {
			pRoot = p.replace('.atom','');
			pRoot = pRoot.replace('.xml','');
			pRoot = pRoot.replace('.json','');
			var sPath = openapi.paths[p];

			var pName = ('all'+pRoot).toCamelCase();
			pName = uniq(pName);

			out += extractParameters(sPath.parameters,pName);

			for (var a in actions) {
				var action = sPath[actions[a]];
				if (action) {
					out += '\n/** '+(action.description ? action.description : action.summary ? action.summary : 'No description');

					pName = (actions[a]+pRoot).toCamelCase();
					pName = uniq(pName);

					if (p.indexOf('{')>=0) {
						var params = [];
						var p2 = pRoot.replace(/(\{.+?\})/g,function(match,group1){
							params.push(group1.replace('{','').replace('}',''));
							return '';
						});
						p2 = p2.replace('-/','/');

						for (var arg in params) {

							var pType = 'string';
							var pDesc = 'No description';

							for (var sp in action.parameters) {
								var sParam = action.parameters[sp];
								if (sParam["$ref"]) {
									if (sParam.$ref.startsWith('#/parameters/')) {
										cParamName = sParam["$ref"].replace('#/parameters/','');
										sParam = openapi.parameters[cParamName];
									}
									if (sParam.$ref && sParam.$ref.startsWith('#/components/parameters/')) {
										cParamName = sParam["$ref"].replace('#/components/parameters/','');
										sParam = openapi.components.parameters[cParamName];
									}
								}

								if (sParam.name == params[arg]) {
									pType = (sParam.type ? sParam.type : sParam.schema.type);
									pDesc = sParam.description;
								}
							}

							out += '\n@param {' + pType + '} ' + params[arg] + ' ' + pDesc;
						}

						out += '\n@return {string} The path to request\n';

						pName = (actions[a]+p2).replaceAll('//','/').toCamelCase();
						if (pName[pName.length-1] == '-') pName = pName.substr(0,pName.length-1);
						while (pName[pName.length-1] == '/') pName = pName.substr(0,pName.length-1);
						pName = uniq(sanitise(pName,true));

						out += '*/\nfunction '+pName+'(';
						for (var arg in params) {
							if (params[arg].substr(0,1).match(/[0-9]/)) {
								params[arg] = '_'+params[arg];
							}
							out += (arg > 0 ? ',' : '') + params[arg].toCamelCase();
						}
						out += '){\n';
						out += "  var p = '" + sanitise((basePath(openapi) + p).replaceAll('//','/'),false) + "';\n";
						for (var arg in params) {
							out += "  p = p.replace('{" + params[arg] + "}'," + params[arg].toCamelCase() + ");\n";
						}
						out += '  return p;\n';
						out += '}\n';
					}
					else {
						out += '*/\nconst '+pName+" = '"+(basePath(openapi)+p).replace('//','/')+"';\n";
					}
					map.push(pName);

					out += extractParameters(action.parameters,pName);
				}
			}
		}

		out += '\nmodule.exports = {\n';
		for (var m in map) {
			out += '  ' + map[m] + ' : ' + map[m] + ',\n';
		}
		if (openapi.host) {
			out += "  host : '" + openapi.host + "'\n";
		}
		if (openapi.servers) {
			if (openapi.servers.length > 0) {
				let up = url.parse(openapi.servers[0].url);
				out += "  host : '" + up.host + "',\n";
			}
			out += "  servers : " + JSON.stringify(openapi.servers) + '\n';
		}
		out += '};\n';

		if (outfile) fs.writeFileSync(outfile,out,'utf8');

		return out;
	}
};
