var oa2js = require('./index.js');

var infile = process.argv[2];
var outfile = process.argv[3];

if (infile && outfile) {
	oa2js.openAPI2js(infile,outfile);
}
else {
	console.log('Usage: openapi2js {infile} {outfile}');
}