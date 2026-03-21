import fs from 'fs';
import { execSync } from 'child_process';

let linesPct = 'unknown';
let testColor = 'red';
try {
  let output = '';
  try {
    output = execSync(
      'npx vitest run --coverage.enabled=true --coverage.reporter=text-summary --coverage.reporter=text',
      { stdio: 'pipe' },
    ).toString();
  } catch (e) {
    output = e.stdout ? e.stdout.toString() : '';
  }

  // Strip ansi color codes
  output = output.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    '',
  );

  const match = output.match(
    /All files\s+\|\s+([0-9.]+)\s+\|\s+([0-9.]+)\s+\|\s+([0-9.]+)\s+\|\s+([0-9.]+)/,
  );
  if (match && match[4]) {
    linesPct = match[4];
    const pct = parseFloat(linesPct);
    testColor = 'brightgreen';
    if (pct < 80) testColor = 'yellow';
    if (pct < 50) testColor = 'red';
  } else {
    console.log('Could not find coverage in output.');
  }
} catch (e) {
  console.log('Error running test coverage.');
}

let docPct = 'unknown';
let docColor = 'red';
try {
  execSync('npx compodoc -p tsconfig.app.json --exportFormat json', { stdio: 'pipe' });
  const docData = JSON.parse(fs.readFileSync('documentation/documentation.json', 'utf-8'));
  const countObj = docData.coverage;
  if (typeof countObj === 'number') {
    docPct = countObj;
  } else if (countObj && countObj.count !== undefined) {
    docPct = countObj.count;
  }

  if (docPct !== 'unknown') {
    const pct = parseFloat(docPct);
    docColor = 'brightgreen';
    if (pct < 80) docColor = 'yellow';
    if (pct < 50) docColor = 'red';
  }
} catch (e) {
  console.log('Could not parse doc coverage.', e.message);
}

let readme = fs.readFileSync('README.md', 'utf-8');

const testRegex =
  /!\[Test Coverage\]\(https:\/\/img\.shields\.io\/badge\/Test_Coverage-[a-zA-Z0-9.]+(?:%25|%)-[a-zA-Z]+\.svg\)\s*/g;
const docRegex =
  /!\[Doc Coverage\]\(https:\/\/img\.shields\.io\/badge\/Doc_Coverage-[a-zA-Z0-9.]+(?:%25|%)-[a-zA-Z]+\.svg\)\s*/g;

readme = readme.replace(testRegex, '');
readme = readme.replace(docRegex, '');

const newTestBadge = `![Test Coverage](https://img.shields.io/badge/Test_Coverage-${linesPct}%25-${testColor}.svg)`;
const newDocBadge = `![Doc Coverage](https://img.shields.io/badge/Doc_Coverage-${docPct}%25-${docColor}.svg)`;

const badges = `${newDocBadge}\n${newTestBadge}\n`;

const titleRegex = /^(cdd-web-ui\r?\n=+\r?\n)/m;
if (readme.match(titleRegex)) {
  readme = readme.replace(titleRegex, `$1\n${badges}`);
} else {
  readme = `${badges}\n${readme}`;
}

readme = readme.replace(/\n{3,}/g, '\n\n');

fs.writeFileSync('README.md', readme);
console.log(`Updated README with Test Coverage: ${linesPct}% and Doc Coverage: ${docPct}%`);
