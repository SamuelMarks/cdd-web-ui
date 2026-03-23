const fs = require('fs');
let content = fs.readFileSync('src/app/store/actions.ts', 'utf8');
content = content.replace("import { Target, LanguageOptions } from '../models/types';", "import { Target, LanguageOptions, InputFormat } from '../models/types';");
content += "\n/** Sets the input format. */\nexport const setInputFormat = createAction(\n  '[OpenAPI] Set Input Format',\n  props<{ format: InputFormat }>()\n);\n";
fs.writeFileSync('src/app/store/actions.ts', content);

let reducers = fs.readFileSync('src/app/store/reducers.ts', 'utf8');
reducers = reducers.replace("validationErrors: [],", "validationErrors: [],\n  inputFormat: 'openapi_3_2_0',");
reducers = reducers.replace("validationErrors: errors,\n  })),", "validationErrors: errors,\n  })),\n  on(Actions.setInputFormat, (state, { format }): OpenApiState => ({\n    ...state,\n    inputFormat: format,\n  })),");
fs.writeFileSync('src/app/store/reducers.ts', reducers);

let selectors = fs.readFileSync('src/app/store/selectors.ts', 'utf8');
selectors += "\nexport const selectOpenApiInputFormat = createSelector(selectOpenApiState, (state) => state.inputFormat);\n";
fs.writeFileSync('src/app/store/selectors.ts', selectors);
