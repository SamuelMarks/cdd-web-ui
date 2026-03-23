const fs = require('fs');
let content = fs.readFileSync('src/app/store/effects.ts', 'utf8');

content = content.replace(
`        if (orientation === 'openapi-left') {
          // Direction: from_openapi -> Code Generation
          
          let upgradePromise = Promise.resolve(specContent);
          
          if (inputFormat !== 'openapi_3_2_0' && lang.repo !== 'cdd-cpp') {`,
`        if (orientation === 'openapi-left') {
          // Direction: from_openapi -> Code Generation
          
          // Override target if language is openapi
          const actualTarget = languageId === 'openapi' ? 'to_openapi_3_2_0' : target;
          
          let upgradePromise = Promise.resolve(specContent);
          
          if (inputFormat !== 'openapi_3_2_0' && lang.repo !== 'cdd-cpp') {`
);

content = content.replace(
`          return upgradePromise.then(upgradedSpec => 
            this.wasmWorkerService.generateCode(lang.repo, upgradedSpec, target, languageOptions)`,
`          return upgradePromise.then(upgradedSpec => 
            this.wasmWorkerService.generateCode(lang.repo, upgradedSpec, actualTarget, languageOptions)`
);

fs.writeFileSync('src/app/store/effects.ts', content);
