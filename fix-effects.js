const fs = require('fs');
let content = fs.readFileSync('src/app/store/effects.ts', 'utf8');

content = content.replace(
"selectOpenApiSpecContent, selectTarget, selectCurrentLanguageOptions } from './selectors';", 
"selectOpenApiSpecContent, selectTarget, selectCurrentLanguageOptions, selectOpenApiInputFormat } from './selectors';"
);

content = content.replace(
"this.store.select(selectCurrentLanguageOptions)\n      ),",
"this.store.select(selectCurrentLanguageOptions),\n        this.store.select(selectOpenApiInputFormat)\n      ),"
);

content = content.replace(
"switchMap(([_, orientation, languageId, specContent, target, languageOptions]) => {",
"switchMap(([_, orientation, languageId, specContent, target, languageOptions, inputFormat]) => {"
);

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
            });
          }
          
          return upgradePromise.then(upgradedSpec => 
            this.wasmWorkerService.generateCode(lang.repo, upgradedSpec, target, languageOptions)
          ).then(`
);

fs.writeFileSync('src/app/store/effects.ts', content);
