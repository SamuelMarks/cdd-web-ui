const fs = require('fs');
let content = fs.readFileSync('src/app/store/effects.ts', 'utf8');

content = content.replace(
`        if (orientation === 'openapi-left') {
          // Direction: from_openapi -> Code Generation
          return this.wasmWorkerService.generateCode(lang.repo, specContent, target, languageOptions).then(`,
`        if (orientation === 'openapi-left') {
          // Direction: from_openapi -> Code Generation
          
          let upgradePromise = Promise.resolve(specContent);
          
          if (inputFormat !== 'openapi_3_2_0' && lang.repo !== 'cdd-cpp') {
            // Need to upgrade spec using cdd-cpp first
            upgradePromise = this.wasmWorkerService.generateCode('cdd-cpp', specContent, 'to_openapi_3_2_0', {
              inputFormat
            }).then(files => {
              const specFile = files.find(f => f.path.endsWith('.yaml') || f.path.endsWith('.json') || f.path.includes('openapi'));
              if (specFile) {
                return new TextDecoder().decode(specFile.content);
              }
              return specContent; // fallback
            }).catch(err => {
              console.warn('Failed to upgrade spec with cdd-cpp', err);
              return specContent; // fallback to original if it fails
            });
          }
          
          return upgradePromise.then(upgradedSpec => 
            this.wasmWorkerService.generateCode(lang.repo, upgradedSpec, target, languageOptions)
          ).then(`
);

fs.writeFileSync('src/app/store/effects.ts', content);
