async function run() {
  const { PhpWeb } = await import('https://cdn.jsdelivr.net/npm/php-wasm@0.0.8/PhpWeb.mjs');
  const php = new PhpWeb();
  php.addEventListener('output', (event) => console.log(event.detail));
  await php.binary;
  php.run('<?php echo "Hello from PHP WASM"; ?>');
}
run();
