# OpenAPI2js

Convert OpenApi (Swagger) 2.0 JSON spec to simple Javascript API, complete with JSDOC, suitable for use with the Open Nitro SDK

## Usage:

````javascript
    var oa2js = require('openapi2js');
    oa2js.openAPI2js(inFilename,outFilename);
````

or

````javascript
    var oa2js = require('openapi2js');
    var jsStr = oa2js.openAPI2js(swaggerObject);
````
